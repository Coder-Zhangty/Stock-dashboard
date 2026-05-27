from __future__ import annotations

from datetime import datetime, timezone
import math
import uuid
import re

from app.core.config import Settings
from app.core.database import get_db
from app.schemas.auth import SessionUser
from pydantic import BaseModel

try:
    import tiktoken
    _TIKTOKEN_AVAILABLE = True
    _TIKTOKEN_ENC = tiktoken.get_encoding('cl100k_base')
except Exception:
    _TIKTOKEN_AVAILABLE = False
    _TIKTOKEN_ENC = None

_CJK_RE = re.compile(r'[一-鿿㐀-䶿豈-﫿]')


MODEL_PRICING = {
    "aurora-mock-chat": {"input": 0.0, "output": 0.0},
    "aurora-mock-admin": {"input": 0.0, "output": 0.0},
    "qwen3-vl-plus": {"input": 0.0022, "output": 0.0068},
    "qwen-vl-max-latest": {"input": 0.0035, "output": 0.0102},
    "qwen2.5-vl-72b-instruct": {"input": 0.0028, "output": 0.0086},
}


class UsageRecord(BaseModel):
    id: str
    user_id: str | None = None
    conversation_id: str | None = None
    provider: str
    model: str
    mode: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost: float
    request_status: str
    attachment_count: int
    last_user_message_preview: str
    created_at: str


class UsageAnalyticsService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def estimate_tokens(text: str) -> int:
        normalized = text.strip()
        if not normalized:
            return 0
        if _TIKTOKEN_AVAILABLE and _TIKTOKEN_ENC is not None:
            try:
                return len(_TIKTOKEN_ENC.encode(normalized))
            except Exception:
                pass
        cjk_chars = len(_CJK_RE.findall(normalized))
        total_chars = len(normalized)
        if total_chars > 0 and cjk_chars / total_chars > 0.3:
            ratio = 2.5
        else:
            ratio = 4.0
        return max(1, math.ceil(total_chars / ratio))

    def record_chat_usage(
        self,
        *,
        user: SessionUser | None,
        conversation_id: str | None,
        provider: str,
        model: str,
        mode: str,
        prompt_text: str,
        completion_text: str,
        attachment_count: int,
        last_user_message_preview: str,
        request_status: str = "success",
        selected_strategy: str | None = None,
    ) -> UsageRecord:
        prompt_tokens = self.estimate_tokens(prompt_text)
        completion_tokens = self.estimate_tokens(completion_text)
        total_tokens = prompt_tokens + completion_tokens
        pricing = MODEL_PRICING.get(model, {"input": 0.0018, "output": 0.0055})
        estimated_cost = round(
            (prompt_tokens / 1000) * pricing["input"]
            + (completion_tokens / 1000) * pricing["output"],
            6,
        )
        record_id = uuid.uuid4().hex
        created_at = datetime.now(timezone.utc).isoformat()

        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO chat_usage_events (
                    id, user_id, conversation_id, user_name, user_email, role, provider, model, mode,
                    prompt_tokens, completion_tokens, total_tokens, attachment_count,
                    estimated_cost, request_status, selected_strategy,
                    last_user_message_preview, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    user.id if user else None,
                    conversation_id,
                    user.name if user else "Guest",
                    user.email if user else "guest@local",
                    user.role if user else "guest",
                    provider,
                    model,
                    (mode or "instant").lower(),
                    prompt_tokens,
                    completion_tokens,
                    total_tokens,
                    attachment_count,
                    estimated_cost,
                    request_status,
                    selected_strategy,
                    last_user_message_preview[:180],
                    created_at,
                ),
            )
            if user:
                connection.execute(
                    """
                    INSERT INTO usage_records (
                        id, user_id, conversation_id, message_id, provider_id, model_id, request_type,
                        prompt_tokens, completion_tokens, total_tokens, estimated_cost, request_status,
                        latency_ms, error_code, error_message, selected_strategy, created_at
                    )
                    VALUES (?, ?, ?, NULL, ?, ?, 'chat', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
                    """,
                    (
                        record_id,
                        user.id,
                        conversation_id,
                        provider,
                        model,
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                        estimated_cost,
                        request_status,
                        selected_strategy,
                        created_at,
                    ),
                )
        return UsageRecord(
            id=record_id,
            user_id=user.id if user else None,
            conversation_id=conversation_id,
            provider=provider,
            model=model,
            mode=(mode or "instant").lower(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost=estimated_cost,
            request_status=request_status,
            attachment_count=attachment_count,
            last_user_message_preview=last_user_message_preview[:180],
            created_at=created_at,
        )
