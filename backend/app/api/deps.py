from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Depends, Header, HTTPException, Request, status

from app.core.config import Settings, settings as app_settings
from app.schemas.auth import SessionUser
from app.services.auth_service import AuthService

# In-memory sliding window rate limiter for unauthenticated routes
_rate_window: dict[str, list[float]] = defaultdict(list)
_last_cleanup: float = 0.0


def _cleanup_rate_window(key: str, window: float, now: float) -> None:
    bucket = _rate_window[key]
    cutoff = now - window
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    # Remove stale key entirely once bucket is empty
    if not bucket:
        del _rate_window[key]


def _sweep_stale_keys(now: float) -> None:
    """Periodically remove keys whose buckets are entirely expired to prevent unbounded dict growth."""
    global _last_cleanup
    # Only sweep every 60 seconds
    if now - _last_cleanup < 60:
        return
    _last_cleanup = now
    stale = [k for k, v in _rate_window.items() if not v]
    for k in stale:
        del _rate_window[k]


def rate_limit(max_requests: int = 30, window_seconds: float = 10.0):
    """Simple sliding-window rate limiter per IP for public endpoints."""
    async def _limiter(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{max_requests}:{window_seconds}"
        now = time.time()
        _sweep_stale_keys(now)
        _cleanup_rate_window(key, window_seconds, now)
        if len(_rate_window[key]) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down.",
            )
        _rate_window[key].append(now)

    return Depends(_limiter)


def _get_settings() -> Settings:
    return app_settings


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        return None
    return authorization[len(prefix):].strip()


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(_get_settings),
) -> SessionUser:
    session_token = request.cookies.get(settings.session_cookie_name)
    service = AuthService(settings)
    user = service.get_user_from_session_token(session_token) if session_token else None
    if user is None:
        bearer = _extract_bearer_token(authorization)
        user = service.refresh_user_from_token(bearer) if bearer else None
    if user is None or user.status not in {"active", "pending"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user


def get_optional_user(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(_get_settings),
) -> SessionUser | None:
    session_token = request.cookies.get(settings.session_cookie_name)
    service = AuthService(settings)
    user = service.get_user_from_session_token(session_token) if session_token else None
    if user:
        return user
    bearer = _extract_bearer_token(authorization)
    if not bearer:
        return None
    try:
        return service.refresh_user_from_token(bearer)
    except Exception:
        return None


def get_current_session_token(
    request: Request,
    settings: Settings = Depends(_get_settings),
) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def verify_csrf(
    request: Request,
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(_get_settings),
) -> None:
    session_token = request.cookies.get(settings.session_cookie_name)

    # For unauthenticated endpoints, verify via Origin header as fallback
    if not session_token:
        origin = request.headers.get("origin") or request.headers.get("referer", "")
        if origin:
            allowed = settings.cors_origins
            if isinstance(allowed, str):
                allowed = [o.strip() for o in allowed.split(",")]
            if not any(origin.startswith(o.rstrip("/")) for o in allowed):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF validation failed.",
                )
        return

    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    if not cookie_token or not x_csrf_token or cookie_token != x_csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed.",
        )


def require_admin(user: SessionUser = Depends(get_current_user)) -> SessionUser:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return user
