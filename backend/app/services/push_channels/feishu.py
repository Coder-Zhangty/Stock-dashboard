from __future__ import annotations

import logging
import httpx

from app.services.push_channels.base import PushChannel

logger = logging.getLogger(__name__)


class FeishuChannel(PushChannel):
    """飞书机器人 Webhook channel."""

    name = "feishu"

    def __init__(self, webhook_url: str = ""):
        self.webhook_url = webhook_url

    def is_configured(self) -> bool:
        return bool(self.webhook_url and "open.feishu.cn" in self.webhook_url)

    async def send(self, title: str, content: str) -> bool:
        if not self.is_configured():
            return False
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    self.webhook_url,
                    json={
                        "msg_type": "interactive",
                        "card": {
                            "header": {
                                "title": {"tag": "plain_text", "content": title},
                                "template": "blue",
                            },
                            "elements": [
                                {
                                    "tag": "markdown",
                                    "content": content[:4000],
                                },
                                {
                                    "tag": "note",
                                    "elements": [{"tag": "plain_text", "content": "由 Trade Dashboard 自动生成"}],
                                },
                            ],
                        },
                    },
                )
                result = resp.json()
                ok = result.get("code") == 0
                if not ok:
                    logger.warning("Feishu push failed: %s", result.get("msg"))
                return ok
        except Exception as exc:
            logger.error("Feishu push error: %s", exc)
            return False
