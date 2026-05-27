from __future__ import annotations

import httpx
from .base import PushChannel


class GotifyChannel(PushChannel):
    name = "gotify"

    def __init__(self, server_url: str, app_token: str):
        self.server_url = server_url.rstrip("/")
        self.app_token = app_token

    async def send(self, title: str, content: str) -> bool:
        if not self.server_url or not self.app_token:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{self.server_url}/message",
                    params={"token": self.app_token},
                    json={"title": title, "message": content, "priority": 5},
                )
                return resp.status_code == 200
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.server_url and self.app_token)
