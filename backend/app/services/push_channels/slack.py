from __future__ import annotations

import httpx
from .base import PushChannel


class SlackChannel(PushChannel):
    name = "slack"

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, title: str, content: str) -> bool:
        if not self.webhook_url:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(self.webhook_url, json={
                    "text": f"*{title}*\n{content}"
                })
                return resp.status_code == 200
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.webhook_url)
