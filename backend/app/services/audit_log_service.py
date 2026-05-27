from __future__ import annotations

from datetime import datetime, timezone
import json
import uuid

from app.core.config import Settings
from app.core.database import get_db


class AuditLogService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def record(
        self,
        *,
        actor_id: str | None,
        actor_name: str,
        actor_role: str,
        action_type: str,
        target_type: str,
        target_id: str | None,
        target_label: str,
        detail: str,
        result: str = "success",
        email: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        detail_json: dict | None = None,
    ) -> None:
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO audit_logs (
                    id, actor_id, actor_name, actor_role, action_type, target_type,
                    target_id, target_label, detail, result, created_at,
                    email, ip_address, user_agent, detail_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    uuid.uuid4().hex,
                    actor_id,
                    actor_name,
                    actor_role,
                    action_type,
                    target_type,
                    target_id,
                    target_label,
                    detail,
                    result,
                    datetime.now(timezone.utc).isoformat(),
                    email.lower() if email else None,
                    ip_address,
                    user_agent,
                    json.dumps(detail_json or {}, ensure_ascii=False),
                ),
            )

    def list_recent(self, limit: int = 50):
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT id, actor_id, actor_name, actor_role, action_type, target_type,
                       target_id, target_label, detail, result, created_at
                FROM audit_logs
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]
