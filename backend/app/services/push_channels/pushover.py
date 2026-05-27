from __future__ import annotations

import httpx
from .base import PushChannel


class PushoverChannel(PushChannel):
    name = "pushover"

    def __init__(self, user_key: str, api_token: str):
        self.user_key = user_key
        self.api_token = api_token

    async def send(self, title: str, content: str) -> bool:
        if not self.api_token or not self.user_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post("https://api.pushover.net/1/messages.json", data={
                    "token": self.api_token,
                    "user": self.user_key,
                    "title": title,
                    "message": content,
                })
                return resp.status_code == 200
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.api_token and self.user_key)
