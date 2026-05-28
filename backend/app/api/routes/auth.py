"""Minimal auth for local single-user deployment — simple session cookie, no CSRF/CAPTCHA/email."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_connection
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/auth")

SESSION_TTL_DAYS = 30


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class SessionUser(BaseModel):
    id: str
    name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    user: SessionUser


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: SessionUser | None = None


def _db_user_to_session(row: dict) -> SessionUser:
    return SessionUser(id=row["id"], name=row["name"], email=row["email"], role=row["role"])


def _get_user_from_cookie(request: Request) -> SessionUser | None:
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
    return _db_user_to_session(row) if row else None


def get_current_user(request: Request) -> SessionUser:
    user = _get_user_from_cookie(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


def get_optional_user(request: Request) -> SessionUser | None:
    return _get_user_from_cookie(request)


def _create_session(conn, user_id: str) -> str:
    import uuid
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    expires = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + SESSION_TTL_DAYS * 86400, tz=timezone.utc
    ).isoformat()
    conn.execute(
        "INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), user_id, token, expires, now),
    )
    return token


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 86400,
        path="/",
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response) -> AuthResponse:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (payload.email.lower(),)).fetchone()
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    with get_connection() as conn:
        token = _create_session(conn, row["id"])
    _set_session_cookie(response, token)
    return AuthResponse(user=_db_user_to_session(row))


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, response: Response) -> AuthResponse:
    import uuid
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(payload.password)
    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (payload.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, payload.name, payload.email.lower(), pw_hash, "user", "active", datetime.now(timezone.utc).isoformat()),
        )
        token = _create_session(conn, user_id)
    _set_session_cookie(response, token)
    return AuthResponse(user=SessionUser(id=user_id, name=payload.name, email=payload.email.lower(), role="user"))


@router.post("/logout")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        with get_connection() as conn:
            conn.execute("DELETE FROM user_sessions WHERE refresh_token_hash = ?", (token,))
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return {"success": True}


@router.get("/session", response_model=AuthStatusResponse)
def get_session(user: SessionUser | None = Depends(get_optional_user)) -> AuthStatusResponse:
    return AuthStatusResponse(authenticated=user is not None, user=user)


@router.get("/me", response_model=SessionUser)
def me(user: SessionUser = Depends(get_current_user)) -> SessionUser:
    return user
