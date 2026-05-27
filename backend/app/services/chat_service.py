from __future__ import annotations

import asyncio
import json
import logging
import re

logger = logging.getLogger(__name__)
from collections.abc import AsyncGenerator

import httpx

from app.core.config import Settings
from app.schemas.auth import SessionUser
from app.schemas.chat import ChatAttachment, ChatMessage
from app.services.auth_service import AuthService
from app.services.conversation_service import ConversationService
from app.services.library_service import AttachmentContext, LibraryService
from app.services.provider_catalog_service import ProviderCatalogService
from app.services.usage_analytics_service import UsageAnalyticsService
from app.services.user_memory_service import UserMemoryService


_MODEL_IDENTITY_QUESTION_RE = re.compile(
    r"("
    r"你\s*(?:是|叫|属于|用的|当前|现在)?\s*(?:什么|哪(?:个|一款|种))?\s*(?:模型|大模型|ai|AI)"
    r"|(?:what|which)\s+(?:model|llm)\s+(?:are\s+you|is\s+this)"
    r"|who\s+are\s+you"
    r"|your\s+(?:current\s+)?model"
    r")",
    re.IGNORECASE,
)

_HISTORY_REFERENCE_RE = re.compile(
    r"(上(?:一|个)|刚才|之前|上一轮|前面|previous|last|earlier|before)",
    re.IGNORECASE,
)


def _sse_event(event: str, payload: dict[str, str]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

FINANCIAL_ANALYST_SYSTEM_PROMPT = """你是一名专业的量化交易分析助手，名字叫 Aurora，覆盖A股（沪深）、港股、美股三大市场。你的职责是为交易者提供专业、客观、数据驱动的市场分析。

## 核心能力
- **技术分析**：解读K线形态、均线系统（MA/MACD/KDJ/RSI/BOLL）、支撑压力位、量价关系
- **基本面分析**：市盈率PE、市净率PB、总市值、换手率、振幅、52周高低点等财务指标
- **资金面分析**：主力资金净流入/流出、成交量与成交额变化、筹码分布特征
- **市场情绪**：结合财经新闻、政策消息、板块轮动判断短期情绪方向

## 回答原则
1. 使用专业金融术语，但确保用户能理解你的分析逻辑
2. 分析时引用具体的行情数据（价格、涨跌幅、成交量等）支撑观点
3. **只做分析，不做买卖推荐**——不给出具体的买入/卖出价位建议
4. 对A股个股的分析，优先结合提供的行情上下文数据
5. 回答简洁有力，直击要点，避免长篇铺垫
6. 涉及风险时务必明确指出（如追高风险、流动性风险、政策风险）
7. 如果用户问的问题超出你的能力范围，诚实告知并建议咨询专业投顾

## 市场上下文
当对话中包含行情数据时，优先基于该数据进行量化分析。如果用户询问的股票不在上下文中，可以基于你的知识库给出一般性分析，但要说明数据可能不是最新的。"""


class ChatService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.auth_service = AuthService(settings)
        self.conversation_service = ConversationService(settings)
        self.library_service = LibraryService(settings)
        self.provider_service = ProviderCatalogService(settings)
        self.usage_service = UsageAnalyticsService(settings)
        self.memory_service = UserMemoryService(settings)

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        user: SessionUser | None = None,
        conversation_id: str | None = None,
        model: str | None = None,
        mode: str | None = None,
        attachments: list[ChatAttachment] | None = None,
        market_context: str | None = None,
    ) -> AsyncGenerator[str, None]:
        completion_parts: list[str] = []
        attachment_context = self.library_service.build_attachment_context(
            attachments=attachments or [],
            owner_id=user.id if user else None,
        )
        messages_for_model = self._augment_messages_with_attachments(messages, attachment_context)
        messages_for_model = self._prepend_financial_persona(messages_for_model)
        messages_for_model = self._prepend_time_context(messages_for_model)
        if market_context:
            messages_for_model = self._prepend_market_context(messages_for_model, market_context)
        if user:
            messages_for_model = self._prepend_user_preference_context(messages_for_model, user_id=user.id)
        latest_user_message = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "",
        )
        persisted_conversation_id = conversation_id
        conversation_selected_model = model
        conversation_selected_strategy = mode
        if user and latest_user_message:
            conversation = self.conversation_service.ensure_conversation(
                user_id=user.id,
                conversation_id=conversation_id,
                first_user_text=latest_user_message,
                selected_model_id=model,
                auto_model_strategy=mode,
            )
            persisted_conversation_id = conversation.id
            if model is None and conversation.selected_model_id:
                conversation_selected_model = conversation.selected_model_id
            if mode is None and conversation.auto_model_strategy:
                conversation_selected_strategy = conversation.auto_model_strategy
            self.conversation_service.append_message(
                conversation_id=conversation.id,
                user_id=user.id,
                role="user",
                content_text=latest_user_message,
                attachments=attachments or [],
            )
        try:
            requested_model = conversation_selected_model
            provider_id, resolved_model = self.provider_service.resolve_model(
                conversation_selected_model,
                role=user.role if user else "user",
                user_id=user.id if user else None,
                strategy=conversation_selected_strategy,
            )
            registry_model = self.provider_service.registry.get_model(resolved_model)
            runtime_model = registry_model.internal_name if registry_model else resolved_model
            self._validate_attachment_support(attachment_context, registry_model)
            messages_for_model = self._sanitize_messages_for_runtime(
                messages_for_model,
                resolved_model=resolved_model,
            )
            messages_for_provider = self._prepend_runtime_model_context(
                messages_for_model,
                resolved_model=resolved_model,
                provider_id=provider_id,
            )
            runtime = self.provider_service.get_provider_runtime(provider_id)
            runtime_base_url = runtime.base_url if runtime and runtime.base_url else self.settings.base_url
            runtime_api_key = runtime.api_key if runtime else None

            use_mock = provider_id == "mock" or not runtime_api_key
            if self.settings.mock_mode and provider_id == "mock":
                use_mock = True

            if use_mock:
                async for chunk in self._stream_mock(
                    messages_for_provider,
                    resolved_model=resolved_model,
                    mode=conversation_selected_strategy,
                    attachments=attachments or [],
                    attachment_context=attachment_context,
                    user=user,
                ):
                    completion_parts.append(chunk)
                    yield _sse_event("chunk", {"delta": chunk})
            else:
                async for chunk in self._stream_compatible_provider(
                    self._to_provider_messages(messages_for_provider, attachment_context),
                    resolved_model=runtime_model,
                    base_url=runtime_base_url,
                    api_key=runtime_api_key,
                ):
                    completion_parts.append(chunk)
                    yield _sse_event("chunk", {"delta": chunk})

            usage_record = self.usage_service.record_chat_usage(
                user=user,
                conversation_id=persisted_conversation_id,
                    provider=provider_id,
                    model=resolved_model,
                    mode=conversation_selected_strategy or "Instant",
                    prompt_text="\n".join(message.content for message in messages_for_provider),
                    completion_text="".join(completion_parts),
                attachment_count=len(attachments or []),
                last_user_message_preview=latest_user_message,
                request_status="success",
                    selected_strategy=(
                        "manual"
                        if requested_model and requested_model == resolved_model
                        else "auto"
                    ),
            )
            if user and persisted_conversation_id:
                self.conversation_service.append_message(
                    conversation_id=persisted_conversation_id,
                    user_id=user.id,
                    role="assistant",
                    content_text="".join(completion_parts),
                    model_id=resolved_model,
                    provider_id=provider_id,
                    prompt_tokens=usage_record.prompt_tokens,
                    completion_tokens=usage_record.completion_tokens,
                    total_tokens=usage_record.total_tokens,
                    estimated_cost=usage_record.estimated_cost,
                )
                self.conversation_service.update_conversation(
                    conversation_id=persisted_conversation_id,
                    user_id=user.id,
                    selected_model_id=resolved_model,
                    auto_model_strategy=conversation_selected_strategy,
                )
                self.memory_service.extract_and_store_memories(
                    user_id=user.id,
                    conversation_id=persisted_conversation_id,
                    user_text=latest_user_message,
                    assistant_text="".join(completion_parts),
                )
            if user:
                self.auth_service.touch_user_activity(user.id)
            yield _sse_event(
                "done",
                {
                    "message": "completed",
                    "provider": usage_record.provider,
                    "model": usage_record.model,
                    "mode": usage_record.mode,
                    "prompt_tokens": str(usage_record.prompt_tokens),
                    "completion_tokens": str(usage_record.completion_tokens),
                    "total_tokens": str(usage_record.total_tokens),
                    "estimated_cost": str(usage_record.estimated_cost),
                    "request_status": usage_record.request_status,
                    "selected_strategy": "manual" if requested_model and requested_model == resolved_model else "auto",
                    "conversation_id": persisted_conversation_id or "",
                },
            )
        except Exception as exc:  # noqa: BLE001
            if user:
                self.usage_service.record_chat_usage(
                    user=user,
                    conversation_id=persisted_conversation_id,
                    provider="error",
                    model=model or "unknown",
                    mode=mode or "Instant",
                    prompt_text="\n".join(message.content for message in messages_for_model),
                    completion_text="",
                    attachment_count=len(attachments or []),
                    last_user_message_preview=latest_user_message,
                    request_status="error",
                    selected_strategy="error",
                )
            logger.exception("Chat streaming error")
            yield _sse_event("error", {"message": "An unexpected error occurred. Please try again."})

    async def _stream_mock(
        self,
        messages: list[ChatMessage],
        *,
        resolved_model: str,
        mode: str | None,
        attachments: list[ChatAttachment],
        attachment_context: list[AttachmentContext],
        user: SessionUser | None,
    ) -> AsyncGenerator[str, None]:
        latest_user_message = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "Hello there.",
        )
        attachment_names = ", ".join(item.name for item in attachments) if attachments else "none"
        user_name = user.name if user else "guest"
        supported_context = [item for item in attachment_context if item.supported]
        unsupported_context = [item for item in attachment_context if not item.supported]
        attachment_summary = ""
        if supported_context:
            attachment_summary = " Parsed file context: " + " | ".join(
                f"{item.name}: {item.excerpt[:180]}" for item in supported_context if item.excerpt
            )
        elif unsupported_context:
            attachment_summary = " File notes: " + " | ".join(
                f"{item.name}: {item.note}" for item in unsupported_context if item.note
            )
        mock_reply = (
            f"This is Aurora's mock streaming reply for {user_name}. "
            f"Model: {resolved_model}. "
            f"Mode: {mode or 'instant'}. "
            f"Attachments: {attachment_names}. "
            f"I received your message: \"{latest_user_message}\". "
            f"{attachment_summary}"
            "Connect a live provider later by saving the platform key in the admin console."
        )

        for token in mock_reply.split(" "):
            await asyncio.sleep(0.045)
            yield f"{token} "

    async def _stream_compatible_provider(
        self,
        messages: list[dict],
        *,
        resolved_model: str,
        base_url: str,
        api_key: str,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": resolved_model,
            "stream": True,
            "messages": messages,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.settings.request_timeout) as client:
            async with client.stream(
                "POST",
                f"{base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue

                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        break

                    chunk = json.loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                    if delta:
                        yield delta

    @staticmethod
    def _augment_messages_with_attachments(
        messages: list[ChatMessage],
        attachment_context: list[AttachmentContext],
    ) -> list[ChatMessage]:
        if not attachment_context:
            return messages

        lines = [
            "The user attached files. Use the following attachment context when it is relevant to the request.",
        ]
        for item in attachment_context:
            if item.supported and item.excerpt:
                lines.append(
                    f"[Attachment: {item.name} | type={item.type}]"
                )
                lines.append(item.excerpt)
            elif item.type == "image" and item.supported:
                lines.append(
                    f"[Attachment: {item.name} | type=image] The image is attached as visual input for vision-capable models."
                )
            else:
                lines.append(
                    f"[Attachment: {item.name} | type={item.type}] {item.note or 'Attached, but content is unavailable.'}"
                )

        return [
            ChatMessage(role="system", content="\n".join(lines)),
            *messages,
        ]

    @staticmethod
    def _validate_attachment_support(attachment_context: list[AttachmentContext], registry_model) -> None:
        image_attachments = [item for item in attachment_context if item.type == "image" and item.data_url]
        if not image_attachments:
            return

        model_type = (getattr(registry_model, "type", "") or "").lower()
        tags = [str(tag).lower() for tag in (getattr(registry_model, "tags", []) or [])]
        supports_vision = model_type == "vision" or "vision" in tags or "vision-capable" in tags
        if not supports_vision:
            names = ", ".join(item.name for item in image_attachments)
            raise ValueError(f"图片附件需要切换到支持视觉的模型后再发送：{names}")

    @staticmethod
    def _to_provider_messages(
        messages: list[ChatMessage],
        attachment_context: list[AttachmentContext],
    ) -> list[dict]:
        payload = [message.model_dump() for message in messages]
        image_items = [item for item in attachment_context if item.type == "image" and item.data_url]
        if not image_items:
            return payload

        for message in reversed(payload):
            if message.get("role") != "user":
                continue
            text = str(message.get("content") or "")
            content: list[dict[str, object]] = []
            if text:
                content.append({"type": "text", "text": text})
            for item in image_items[:6]:
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": item.data_url, "detail": "auto"},
                    }
                )
            message["content"] = content
            break
        return payload

    @staticmethod
    def _is_model_identity_question(content: str) -> bool:
        return bool(_MODEL_IDENTITY_QUESTION_RE.search(content)) and not bool(
            _HISTORY_REFERENCE_RE.search(content)
        )

    def _sanitize_messages_for_runtime(
        self,
        messages: list[ChatMessage],
        *,
        resolved_model: str,
    ) -> list[ChatMessage]:
        latest_user_message = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "",
        )
        if not self._is_model_identity_question(latest_user_message):
            return messages

        # Identity questions are especially prone to being contaminated by older
        # assistant self-introductions after the user switches models.
        return [
            *[message for message in messages if message.role == "system"],
            ChatMessage(
                role="system",
                content=(
                    "The user is asking about the currently active model. "
                    f"Answer only according to the current active model '{resolved_model}'. "
                    "Ignore any previous assistant message that claimed a different model identity."
                ),
            ),
            ChatMessage(role="user", content=latest_user_message),
        ]

    @staticmethod
    def _prepend_runtime_model_context(
        messages: list[ChatMessage],
        *,
        resolved_model: str,
        provider_id: str,
    ) -> list[ChatMessage]:
        runtime_note = (
            "System note: the active model for this response is "
            f"'{resolved_model}' from provider '{provider_id}'. "
            "Continue using the existing conversation context, but if the conversation contains "
            "answers from a previous model, do not copy that previous model's identity. "
            "When the user asks what model you are, answer as the current active model."
        )
        return [ChatMessage(role="system", content=runtime_note), *messages]

    @staticmethod
    def _prepend_financial_persona(
        messages: list[ChatMessage],
    ) -> list[ChatMessage]:
        return [ChatMessage(role="system", content=FINANCIAL_ANALYST_SYSTEM_PROMPT), *messages]

    @staticmethod
    def _prepend_time_context(
        messages: list[ChatMessage],
    ) -> list[ChatMessage]:
        from datetime import datetime, timezone, timedelta
        tz = timezone(timedelta(hours=8))
        now = datetime.now(tz)
        time_str = now.strftime("%Y-%m-%d %H:%M:%S UTC+8")
        weekday_cn = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
        is_weekday = now.weekday() < 5

        # A-share session: 9:30-11:30, 13:00-15:00
        a_morning = (9, 15) <= (now.hour, now.minute) < (11, 30)
        a_afternoon = (13, 0) <= (now.hour, now.minute) < (15, 0)
        a_in_session = is_weekday and (a_morning or a_afternoon)

        # HK session: 9:30-12:00, 13:00-16:00
        hk_morning = (9, 15) <= (now.hour, now.minute) < (12, 0)
        hk_afternoon = (13, 0) <= (now.hour, now.minute) < (16, 0)
        hk_in_session = is_weekday and (hk_morning or hk_afternoon)

        # US session (Beijing time: 21:30-04:00 next day, summer; 22:30-05:00 winter)
        us_open_h = 21 if 3 <= now.month <= 10 else 22
        us_close_h = 4 if 3 <= now.month <= 10 else 5
        us_in_session = (now.hour >= us_open_h or now.hour < us_close_h)

        parts = [f"当前日期时间：{time_str}，星期{weekday_cn}。"]
        parts.append(f"A股：{'交易中' if a_in_session else '已收盘/未开盘'}（工作日 9:30-11:30、13:00-15:00）")
        parts.append(f"港股：{'交易中' if hk_in_session else '已收盘/未开盘'}（工作日 9:30-12:00、13:00-16:00）")
        parts.append(f"美股：{'交易中' if us_in_session else '已收盘/未开盘'}（北京时间 {'21:30' if us_open_h == 21 else '22:30'}-{'04:00' if us_close_h == 4 else '05:00'}，夏令时+冬令时）")
        content = " ".join(parts)
        return [ChatMessage(role="system", content=content), *messages]

    @staticmethod
    def _prepend_market_context(
        messages: list[ChatMessage],
        market_context: str,
    ) -> list[ChatMessage]:
        if not market_context.strip():
            return messages
        system_message = ChatMessage(
            role="system",
            content=(
                "以下是用户当前查看的行情实时数据，请基于这些数据进行分析：\n\n"
                f"{market_context.strip()}\n\n"
                "请优先基于以上行情数据进行量化分析，引用具体数值支撑你的观点。"
            ),
        )
        return [system_message, *messages]

    def _prepend_user_preference_context(
        self,
        messages: list[ChatMessage],
        *,
        user_id: str,
    ) -> list[ChatMessage]:
        return [
            ChatMessage(role="system", content=self.memory_service.build_preference_context(user_id)),
            *messages,
        ]
