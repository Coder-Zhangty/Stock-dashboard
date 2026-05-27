from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

from fastapi import HTTPException, status

from app.core.config import Settings
from app.core.database import get_db


class AuthRateLimitService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @classmethod
    def _now_iso(cls) -> str:
        return cls._now().isoformat()

    @staticmethod
    def _normalize_scope_key(scope_key: str | None) -> str | None:
        if not scope_key:
            return None
        value = scope_key.strip().lower()
        return value or None

    def _fetch(self, *, scope_type: str, scope_key: str, action_type: str):
        with get_db() as connection:
            return connection.execute(
                """
                SELECT id, failure_count, last_failure_at, cooldown_until
                FROM auth_rate_limits
                WHERE scope_type = ? AND scope_key = ? AND action_type = ?
                """,
                (scope_type, scope_key, action_type),
            ).fetchone()

    def assert_not_limited(self, *, scope_type: str, scope_key: str | None, action_type: str) -> None:
        normalized = self._normalize_scope_key(scope_key)
        if normalized is None:
            return
        row = self._fetch(scope_type=scope_type, scope_key=normalized, action_type=action_type)
        if row is None or not row["cooldown_until"]:
            return
        cooldown_until = datetime.fromisoformat(row["cooldown_until"])
        if cooldown_until <= self._now():
            return
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
        )

    def register_attempt(
        self,
        *,
        scope_type: str,
        scope_key: str | None,
        action_type: str,
        threshold: int,
        cooldown_base_seconds: int,
    ) -> tuple[int, int]:
        normalized = self._normalize_scope_key(scope_key)
        if normalized is None:
            return 0, 0

        now = self._now()
        window_start = now - timedelta(minutes=self.settings.auth_rate_limit_window_minutes)
        row = self._fetch(scope_type=scope_type, scope_key=normalized, action_type=action_type)

        count = 1
        if row and row["last_failure_at"]:
            last_failure_at = datetime.fromisoformat(row["last_failure_at"])
            if last_failure_at >= window_start:
                count = int(row["failure_count"] or 0) + 1

        cooldown_seconds = 0
        cooldown_until = None
        if count >= threshold:
            cooldown_multiplier = max(1, count - threshold + 1)
            cooldown_seconds = cooldown_base_seconds * cooldown_multiplier
            cooldown_until = (now + timedelta(seconds=cooldown_seconds)).isoformat()

        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO auth_rate_limits (
                    id, scope_type, scope_key, action_type, failure_count,
                    last_failure_at, cooldown_until, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(scope_type, scope_key, action_type) DO UPDATE SET
                    failure_count = excluded.failure_count,
                    last_failure_at = excluded.last_failure_at,
                    cooldown_until = excluded.cooldown_until,
                    updated_at = excluded.updated_at
                """,
                (
                    uuid.uuid4().hex,
                    scope_type,
                    normalized,
                    action_type,
                    count,
                    now.isoformat(),
                    cooldown_until,
                    self._now_iso(),
                    self._now_iso(),
                ),
            )
        return count, cooldown_seconds

    def clear(self, *, scope_type: str, scope_key: str | None, action_type: str) -> None:
        normalized = self._normalize_scope_key(scope_key)
        if normalized is None:
            return
        with get_db() as connection:
            connection.execute(
                """
                DELETE FROM auth_rate_limits
                WHERE scope_type = ? AND scope_key = ? AND action_type = ?
                """,
                (scope_type, normalized, action_type),
            )
