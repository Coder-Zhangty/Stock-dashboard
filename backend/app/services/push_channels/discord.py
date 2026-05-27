from __future__ import annotations

import httpx
from .base import PushChannel


class DiscordChannel(PushChannel):
    name = "discord"

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, title: str, content: str) -> bool:
        if not self.webhook_url:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(self.webhook_url, json={
                    "embeds": [{"title": title, "description": content, "color": 0x3b82f6}]
                })
                return resp.status_code in (200, 204)
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.webhook_url)
