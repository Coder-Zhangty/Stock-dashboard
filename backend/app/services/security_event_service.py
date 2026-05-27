from __future__ import annotations

from datetime import datetime, timezone
import json
import uuid

from app.core.config import Settings
from app.core.database import get_db


class SecurityEventService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def record(
        self,
        *,
        actor_user_id: str | None,
        email: str | None,
        action_type: str,
        ip_address: str | None,
        user_agent: str | None,
        result: str,
        detail: dict | None = None,
    ) -> None:
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO security_events (
                    id, actor_user_id, email, action_type, ip_address,
                    user_agent, result, detail_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    uuid.uuid4().hex,
                    actor_user_id,
                    email.lower() if email else None,
                    action_type,
                    ip_address,
                    user_agent,
                    result,
                    json.dumps(detail or {}, ensure_ascii=False),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

    def list_recent(self, limit: int = 100) -> list[dict]:
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT id, actor_user_id, email, action_type, ip_address, user_agent,
                       result, detail_json, created_at
                FROM security_events
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]
