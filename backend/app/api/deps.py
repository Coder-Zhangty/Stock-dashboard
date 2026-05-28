"""Auth dependencies — minimal session-cookie based auth for local deployment."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.database import get_connection


class SessionUser:
    def __init__(self, id: str, name: str, email: str, role: str):
        self.id = id
        self.name = name
        self.email = email
        self.role = role


def get_current_user(request: Request) -> SessionUser:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT u.id, u.name, u.email, u.role FROM user_sessions s "
            "JOIN users u ON s.user_id = u.id "
            "WHERE s.refresh_token_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL",
            (token, datetime.now(timezone.utc).isoformat()),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return SessionUser(id=row["id"], name=row["name"], email=row["email"], role=row["role"])


def get_optional_user(request: Request) -> SessionUser | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    with get_connection() as conn:
        row = conn.execute(
            "SELECT u.id, u.name, u.email, u.role FROM user_sessions s "
            "JOIN users u ON s.user_id = u.id "
            "WHERE s.refresh_token_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL",
            (token, datetime.now(timezone.utc).isoformat()),
        ).fetchone()
    if not row:
        return None
    return SessionUser(id=row["id"], name=row["name"], email=row["email"], role=row["role"])
