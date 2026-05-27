from __future__ import annotations

from datetime import datetime, timezone
import re
import uuid

from app.core.config import Settings
from app.core.database import get_db
from app.schemas.preferences import (
    UserMemoryResponse,
    UserPreferenceResponse,
    UserPreferenceUpdateRequest,
)


SENSITIVE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"password|密码|passcode|secret|api[_ -]?key|token|验证码",
        r"\b\d{15,19}\b",
        r"\b\d{3}-\d{2}-\d{4}\b",
    ]
]


class UserMemoryService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _preference_from_row(row) -> UserPreferenceResponse:
        return UserPreferenceResponse(
            memory_enabled=bool(row["memory_enabled"]),
            tone_style=row["tone_style"],
            warmth=row["warmth"],
            response_length=row["response_length"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _memory_from_row(row) -> UserMemoryResponse:
        return UserMemoryResponse(
            id=row["id"],
            user_id=row["user_id"],
            content=row["content"],
            source_conversation_id=row["source_conversation_id"],
            confidence=float(row["confidence"]),
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def ensure_preferences(self, user_id: str) -> UserPreferenceResponse:
        now = self._now()
        with get_db() as connection:
            row = connection.execute(
                "SELECT * FROM user_preferences WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            if row is None:
                connection.execute(
                    """
                    INSERT INTO user_preferences (
                        user_id, memory_enabled, tone_style, warmth, response_length, created_at, updated_at
                    )
                    VALUES (?, 1, 'professional', 55, 62, ?, ?)
                    """,
                    (user_id, now, now),
                )
                row = connection.execute(
                    "SELECT * FROM user_preferences WHERE user_id = ?",
                    (user_id,),
                ).fetchone()
        return self._preference_from_row(row)

    def update_preferences(self, user_id: str, payload: UserPreferenceUpdateRequest) -> UserPreferenceResponse:
        current = self.ensure_preferences(user_id)
        patch = payload.model_dump(exclude_unset=True)
        now = self._now()
        with get_db() as connection:
            connection.execute(
                """
                UPDATE user_preferences
                SET memory_enabled = ?, tone_style = ?, warmth = ?, response_length = ?, updated_at = ?
                WHERE user_id = ?
                """,
                (
                    1 if patch.get("memory_enabled", current.memory_enabled) else 0,
                    patch.get("tone_style", current.tone_style),
                    patch.get("warmth", current.warmth),
                    patch.get("response_length", current.response_length),
                    now,
                    user_id,
                ),
            )
        return self.ensure_preferences(user_id)

    def list_memories(self, user_id: str, *, include_deleted: bool = False) -> list[UserMemoryResponse]:
        query = """
            SELECT id, user_id, content, source_conversation_id, confidence, status, created_at, updated_at
            FROM user_memories
            WHERE user_id = ?
        """
        if not include_deleted:
            query += " AND status = 'active' AND deleted_at IS NULL"
        query += " ORDER BY datetime(updated_at) DESC LIMIT 100"
        with get_db() as connection:
            rows = connection.execute(query, (user_id,)).fetchall()
        return [self._memory_from_row(row) for row in rows]

    def delete_memory(self, user_id: str, memory_id: str) -> bool:
        now = self._now()
        with get_db() as connection:
            cursor = connection.execute(
                """
                UPDATE user_memories
                SET status = 'deleted', deleted_at = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND deleted_at IS NULL
                """,
                (now, now, memory_id, user_id),
            )
            return cursor.rowcount > 0

    def build_preference_context(self, user_id: str) -> str:
        preferences = self.ensure_preferences(user_id)
        tone_map = {
            "professional": "professional, precise, and direct",
            "friendly": "friendly, encouraging, and easy to understand",
            "quirky": "lightly playful while staying useful and accurate",
            "honest": "candid, plain-spoken, and careful about uncertainty",
        }
        length = (
            "concise" if preferences.response_length < 35 else
            "balanced" if preferences.response_length < 75 else
            "detailed"
        )
        warmth = (
            "low warmth" if preferences.warmth < 35 else
            "moderate warmth" if preferences.warmth < 75 else
            "high warmth"
        )
        lines = [
            "User response preferences:",
            f"- Tone: {tone_map.get(preferences.tone_style, tone_map['professional'])}.",
            f"- Warmth: {warmth}.",
            f"- Response length: {length}.",
        ]
        if preferences.memory_enabled:
            memories = self.list_memories(user_id)
            if memories:
                lines.append("User memories to respect when relevant:")
                lines.extend(f"- {memory.content}" for memory in memories[:12])
        else:
            lines.append("User memory is disabled; do not use stored memories.")
        return "\n".join(lines)

    @staticmethod
    def _is_sensitive(text: str) -> bool:
        return any(pattern.search(text) for pattern in SENSITIVE_PATTERNS)

    @staticmethod
    def _normalize_memory(text: str) -> str:
        return re.sub(r"\s+", " ", text.strip(" .。!！?？")).strip()

    def extract_and_store_memories(
        self,
        *,
        user_id: str,
        conversation_id: str | None,
        user_text: str,
        assistant_text: str,
    ) -> None:
        preferences = self.ensure_preferences(user_id)
        if not preferences.memory_enabled:
            return

        candidates: list[str] = []
        text = user_text.strip()
        lowered = text.lower()
        explicit_markers = ["remember that", "please remember", "记住", "请记住", "以后都", "我喜欢", "我偏好", "my preference"]
        if any(marker in lowered or marker in text for marker in explicit_markers):
            candidates.append(text)
        stable_patterns = [
            r"(?:I prefer|I like|I usually|My name is|I work as|我喜欢|我偏好|我通常|我的名字是|我是)([^。.!?\n]{2,120})",
        ]
        for pattern in stable_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                candidates.append(match.group(0))

        now = self._now()
        with get_db() as connection:
            for candidate in candidates[:3]:
                content = self._normalize_memory(candidate)
                if len(content) < 8 or len(content) > 240 or self._is_sensitive(content):
                    continue
                existing = connection.execute(
                    """
                    SELECT id FROM user_memories
                    WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
                      AND lower(content) = lower(?)
                    """,
                    (user_id, content),
                ).fetchone()
                if existing:
                    connection.execute(
                        "UPDATE user_memories SET updated_at = ?, confidence = ? WHERE id = ?",
                        (now, 0.82, existing["id"]),
                    )
                    continue
                connection.execute(
                    """
                    INSERT INTO user_memories (
                        id, user_id, content, source_conversation_id, confidence, status,
                        created_at, updated_at, deleted_at
                    )
                    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NULL)
                    """,
                    (uuid.uuid4().hex, user_id, content, conversation_id, 0.78, now, now),
                )
