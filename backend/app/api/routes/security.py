from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.api.deps import verify_csrf
from app.core.config import settings as app_settings
from app.services.captcha_service import CaptchaService
from app.services.security_event_service import SecurityEventService

router = APIRouter(prefix="/security")


class VerifyHumanRequest(BaseModel):
    token: str = Field(min_length=1, max_length=2048)
    action: str = Field(default="generic", min_length=1, max_length=80)


class VerifyHumanResponse(BaseModel):
    success: bool = True
    provider: str


@router.post("/verify-human", response_model=VerifyHumanResponse)
async def verify_human(
    payload: VerifyHumanRequest,
    request: Request,
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> VerifyHumanResponse:
    captcha = CaptchaService(settings)
    try:
        await captcha.verify_or_raise(
            token=payload.token,
            remote_ip=request.client.host if request.client else None,
            action=payload.action,
        )
    except Exception:
        SecurityEventService(settings).record(
            actor_user_id=None,
            email=None,
            action_type="auth.captcha_failed",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            result="failed",
            detail={"action": payload.action},
        )
        raise
    return VerifyHumanResponse(success=True, provider=settings.captcha_provider)
