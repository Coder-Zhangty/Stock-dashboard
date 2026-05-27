from __future__ import annotations

import httpx
from .base import PushChannel


class NtfyChannel(PushChannel):
    name = "ntfy"

    def __init__(self, server_url: str, topic: str, auth_token: str = ""):
        self.server_url = server_url.rstrip("/")
        self.topic = topic
        self.auth_token = auth_token

    async def send(self, title: str, content: str) -> bool:
        if not self.server_url or not self.topic:
            return False
        try:
            headers = {}
            if self.auth_token:
                headers["Authorization"] = f"Bearer {self.auth_token}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{self.server_url}/{self.topic}",
                    data=content,
                    headers={**headers, "Title": title},
                )
                return resp.status_code == 200
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.server_url and self.topic)
