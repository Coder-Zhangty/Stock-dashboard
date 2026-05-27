from __future__ import annotations

from fastapi import HTTPException, status
import httpx

from app.core.config import Settings


class CaptchaService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return (
            self.settings.captcha_provider == "turnstile"
            and bool(self.settings.turnstile_site_key)
            and bool(self.settings.turnstile_secret_key)
        )

    def get_frontend_config(self) -> dict:
        return {
            "provider": self.settings.captcha_provider,
            "site_key": self.settings.turnstile_site_key if self.enabled else None,
            "mock_token_hint": self.settings.mock_captcha_token
            if not self.settings.is_production and not self.enabled
            else None,
        }

    async def verify_or_raise(
        self,
        *,
        token: str | None,
        remote_ip: str | None,
        action: str,
    ) -> None:
        if self.settings.is_production and not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Human verification is not configured for production.",
            )
        if self.settings.is_production and self.settings.captcha_provider != "turnstile":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Human verification is not configured for production.",
            )
        if self.enabled:
            await self._verify_turnstile(token=token, remote_ip=remote_ip, action=action)
            return
        if token != self.settings.mock_captcha_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Human verification failed.",
            )

    async def _verify_turnstile(
        self,
        *,
        token: str | None,
        remote_ip: str | None,
        action: str,
    ) -> None:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Human verification failed.",
            )
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": self.settings.turnstile_secret_key,
                    "response": token,
                    "remoteip": remote_ip,
                },
            )
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Human verification failed.",
            ) from exc
        allowed_hostnames = {hostname.lower() for hostname in self.settings.turnstile_allowed_hostnames}
        hostname = str(payload.get("hostname") or "").lower()
        token_action = payload.get("action")
        if not payload.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Human verification failed.",
            )
        if allowed_hostnames and hostname not in allowed_hostnames:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Human verification failed.",
            )
        if token_action and token_action != action:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Human verification failed.",
            )
