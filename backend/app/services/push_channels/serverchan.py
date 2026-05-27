from __future__ import annotations

import httpx
from .base import PushChannel


class ServerChanChannel(PushChannel):
    name = "serverchan"

    def __init__(self, send_key: str):
        self.send_key = send_key

    async def send(self, title: str, content: str) -> bool:
        if not self.send_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"https://sctapi.ftqq.com/{self.send_key}.send",
                    data={"title": title, "desp": content},
                )
                return resp.status_code == 200
        except Exception:
            return False

    def is_configured(self) -> bool:
        return bool(self.send_key)
