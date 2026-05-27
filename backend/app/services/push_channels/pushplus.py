from __future__ import annotations

import httpx
from .base import PushChannel


class PushPlusChannel(PushChannel):
    name = "pushplus"

    def __init__(self, token: str):
        self.token = token

    async def send(self, title: str, content: str) -> bool:
        if not self.token:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post("http://www.pushplus.plus/send", json={
                    "token": self.token,
                    "title": title,
                    "content": content,
                    "template": "markdown",
                })
                return resp.status_code == 200
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.token)
