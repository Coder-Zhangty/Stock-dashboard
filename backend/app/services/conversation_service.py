from __future__ import annotations

from datetime import datetime, timezone
import uuid

from app.core.config import Settings
from app.core.database import get_db
from app.schemas.chat import ChatAttachment
from app.schemas.platform import ConversationResponse, MessageAttachmentResponse, MessageResponse
from app.schemas.platform import ConversationImportItem, ConversationImportMessage


class ConversationService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _derive_title(text: str) -> str:
        cleaned = " ".join(text.strip().split())
        if not cleaned:
            return "新对话"
        return cleaned[:40]

    def list_conversations(self, user_id: str) -> list[ConversationResponse]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT id, user_id, title, selected_model_id, auto_model_strategy,
                       last_message_at, created_at, updated_at, archived_at
                FROM conversations
                WHERE user_id = ? AND deleted_at IS NULL
                ORDER BY datetime(last_message_at) DESC, datetime(created_at) DESC
                """,
                (user_id,),
            ).fetchall()
        return [ConversationResponse(**dict(row)) for row in rows]

    def get_conversation(self, conversation_id: str, user_id: str) -> ConversationResponse | None:
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT id, user_id, title, selected_model_id, auto_model_strategy,
                       last_message_at, created_at, updated_at, archived_at
                FROM conversations
                WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                """,
                (conversation_id, user_id),
            ).fetchone()
        return ConversationResponse(**dict(row)) if row else None

    def create_conversation(
        self,
        *,
        user_id: str,
        title: str | None = None,
        selected_model_id: str | None = None,
        auto_model_strategy: str | None = None,
    ) -> ConversationResponse:
        conversation_id = uuid.uuid4().hex
        now = self._now()
        title_value = title or "新对话"
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO conversations (
                    id, user_id, title, selected_model_id, auto_model_strategy,
                    last_message_at, created_at, updated_at, archived_at, deleted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (conversation_id, user_id, title_value, selected_model_id, auto_model_strategy, now, now, now),
            )
        return self.get_conversation(conversation_id, user_id)  # type: ignore[return-value]

    def update_conversation(
        self,
        *,
        conversation_id: str,
        user_id: str,
        title: str | None = None,
        selected_model_id: str | None = None,
        auto_model_strategy: str | None = None,
        archived: bool | None = None,
    ) -> ConversationResponse | None:
        current = self.get_conversation(conversation_id, user_id)
        if current is None:
            return None
        archived_at = current.archived_at
        if archived is True:
            archived_at = self._now()
        elif archived is False:
            archived_at = None
        with get_db() as connection:
            connection.execute(
                """
                UPDATE conversations
                SET title = ?, selected_model_id = ?, auto_model_strategy = ?, archived_at = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                """,
                (
                    title or current.title,
                    selected_model_id if selected_model_id is not None else current.selected_model_id,
                    auto_model_strategy if auto_model_strategy is not None else current.auto_model_strategy,
                    archived_at,
                    self._now(),
                    conversation_id,
                    user_id,
                ),
            )
        return self.get_conversation(conversation_id, user_id)

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        with get_db() as connection:
            connection.execute(
                "UPDATE conversations SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (self._now(), self._now(), conversation_id, user_id),
            )
            return connection.total_changes > 0

    def list_messages(self, conversation_id: str, user_id: str) -> list[MessageResponse]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT messages.id, messages.conversation_id, messages.user_id, messages.role,
                       messages.content_text, messages.model_id, messages.provider_id,
                       messages.prompt_tokens, messages.completion_tokens, messages.total_tokens,
                       messages.estimated_cost, messages.created_at
                FROM messages
                INNER JOIN conversations ON conversations.id = messages.conversation_id
                WHERE messages.conversation_id = ? AND conversations.user_id = ? AND conversations.deleted_at IS NULL
                ORDER BY datetime(messages.created_at) ASC
                """,
                (conversation_id, user_id),
            ).fetchall()
            attachment_map = self._load_message_attachments(
                connection,
                [row["id"] for row in rows],
            )
        return [
            MessageResponse(**dict(row), attachments=attachment_map.get(row["id"], []))
            for row in rows
        ]

    def ensure_conversation(
        self,
        *,
        user_id: str,
        conversation_id: str | None,
        first_user_text: str,
        selected_model_id: str | None = None,
        auto_model_strategy: str | None = None,
    ) -> ConversationResponse:
        if conversation_id:
            existing = self.get_conversation(conversation_id, user_id)
            if existing:
                return existing
        return self.create_conversation(
            user_id=user_id,
            title=self._derive_title(first_user_text),
            selected_model_id=selected_model_id,
            auto_model_strategy=auto_model_strategy,
        )

    def append_message(
        self,
        *,
        conversation_id: str,
        user_id: str | None,
        role: str,
        content_text: str,
        model_id: str | None = None,
        provider_id: str | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        total_tokens: int | None = None,
        estimated_cost: float | None = None,
        attachments: list[ChatAttachment] | None = None,
    ) -> MessageResponse:
        message_id = uuid.uuid4().hex
        created_at = self._now()
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO messages (
                    id, conversation_id, user_id, role, content_text, model_id, provider_id,
                    prompt_tokens, completion_tokens, total_tokens, estimated_cost, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    message_id,
                    conversation_id,
                    user_id,
                    role,
                    content_text,
                    model_id,
                    provider_id,
                    prompt_tokens,
                    completion_tokens,
                    total_tokens,
                    estimated_cost,
                    created_at,
                ),
            )
            connection.execute(
                "UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?",
                (created_at, created_at, conversation_id),
            )
            self._insert_file_references(
                connection,
                conversation_id=conversation_id,
                message_id=message_id,
                attachments=attachments or [],
                referenced_at=created_at,
            )
            stored_attachments = self._load_message_attachments(connection, [message_id]).get(message_id, [])
        return MessageResponse(
            id=message_id,
            conversation_id=conversation_id,
            user_id=user_id,
            role=role,
            content_text=content_text,
            model_id=model_id,
            provider_id=provider_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost=estimated_cost,
            created_at=created_at,
            attachments=stored_attachments,
        )

    @staticmethod
    def _safe_timestamp(value: str | None, fallback: str) -> str:
        if not value:
            return fallback
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return value
        except ValueError:
            return fallback

    def import_local_conversations(
        self,
        *,
        user_id: str,
        conversations: list[ConversationImportItem],
    ) -> list[ConversationResponse]:
        imported_ids: list[str] = []
        now = self._now()
        with get_db() as connection:
            for item in conversations:
                if not item.messages and not (item.title and item.title.strip()):
                    continue
                conversation_id = uuid.uuid4().hex
                created_at = self._safe_timestamp(item.created_at, now)
                updated_at = self._safe_timestamp(item.updated_at, created_at)
                last_message_at = updated_at
                if item.messages:
                    last_message_at = self._safe_timestamp(item.messages[-1].created_at, updated_at)
                title = (item.title or "").strip() or "Imported conversation"
                connection.execute(
                    """
                    INSERT INTO conversations (
                        id, user_id, title, selected_model_id, auto_model_strategy,
                        last_message_at, created_at, updated_at, archived_at, deleted_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                    """,
                    (
                        conversation_id,
                        user_id,
                        title[:200],
                        item.selected_model_id,
                        item.auto_model_strategy,
                        last_message_at,
                        created_at,
                        updated_at,
                    ),
                )
                for message in item.messages:
                    self._insert_imported_message(connection, conversation_id, user_id, message, now)
                imported_ids.append(conversation_id)

        return [
            conversation
            for conversation_id in imported_ids
            if (conversation := self.get_conversation(conversation_id, user_id)) is not None
        ]

    def replace_messages(
        self,
        *,
        conversation_id: str,
        user_id: str,
        messages: list[ConversationImportMessage],
    ) -> list[MessageResponse] | None:
        current = self.get_conversation(conversation_id, user_id)
        if current is None:
            return None
        now = self._now()
        with get_db() as connection:
            connection.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
            connection.execute("DELETE FROM file_references WHERE conversation_id = ?", (conversation_id,))
            for message in messages:
                self._insert_imported_message(connection, conversation_id, user_id, message, now)
            last_message_at = (
                self._safe_timestamp(messages[-1].created_at, now) if messages else current.created_at
            )
            connection.execute(
                "UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                (last_message_at, now, conversation_id, user_id),
            )
        return self.list_messages(conversation_id, user_id)

    def _insert_imported_message(
        self,
        connection,
        conversation_id: str,
        user_id: str,
        message: ConversationImportMessage,
        fallback_created_at: str,
    ) -> None:
        created_at = self._safe_timestamp(message.created_at, fallback_created_at)
        message_id = uuid.uuid4().hex
        connection.execute(
            """
            INSERT INTO messages (
                id, conversation_id, user_id, role, content_text, model_id, provider_id,
                prompt_tokens, completion_tokens, total_tokens, estimated_cost, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)
            """,
            (
                message_id,
                conversation_id,
                user_id if message.role == "user" else None,
                message.role,
                message.content_text,
                message.model_id,
                message.provider_id,
                created_at,
            ),
        )
        self._insert_file_references(
            connection,
            conversation_id=conversation_id,
            message_id=message_id,
            attachments=[
                ChatAttachment(
                    id=attachment.id,
                    name=attachment.name,
                    type=attachment.type,
                    source=attachment.source,
                )
                for attachment in message.attachments
            ],
            referenced_at=created_at,
        )

    @staticmethod
    def _insert_file_references(
        connection,
        *,
        conversation_id: str,
        message_id: str,
        attachments: list[ChatAttachment],
        referenced_at: str,
    ) -> None:
        seen: set[str] = set()
        for attachment in attachments:
            if not attachment.id or attachment.id.startswith("tool-") or attachment.id in seen:
                continue
            seen.add(attachment.id)
            exists = connection.execute(
                "SELECT id FROM library_items WHERE id = ?",
                (attachment.id,),
            ).fetchone()
            if not exists:
                continue
            connection.execute(
                """
                INSERT INTO file_references (id, file_id, conversation_id, message_id, referenced_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (uuid.uuid4().hex, attachment.id, conversation_id, message_id, referenced_at),
            )

    @staticmethod
    def _load_message_attachments(connection, message_ids: list[str]) -> dict[str, list[MessageAttachmentResponse]]:
        if not message_ids:
            return {}
        placeholders = ",".join("?" for _ in message_ids)
        rows = connection.execute(
            f"""
            SELECT file_references.message_id, library_items.id, library_items.name,
                   library_items.type, library_items.source, library_items.size_label,
                   library_items.created_at
            FROM file_references
            INNER JOIN library_items ON library_items.id = file_references.file_id
            WHERE file_references.message_id IN ({placeholders})
            ORDER BY datetime(file_references.referenced_at) ASC
            """,
            tuple(message_ids),
        ).fetchall()
        result: dict[str, list[MessageAttachmentResponse]] = {message_id: [] for message_id in message_ids}
        for row in rows:
            result.setdefault(row["message_id"], []).append(
                MessageAttachmentResponse(
                    id=row["id"],
                    name=row["name"],
                    type=row["type"],
                    source=row["source"],
                    size_label=row["size_label"],
                    created_at=row["created_at"],
                )
            )
        return result
