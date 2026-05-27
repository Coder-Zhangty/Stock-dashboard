from __future__ import annotations

import logging
import httpx

from app.services.push_channels.base import PushChannel

logger = logging.getLogger(__name__)


class WeComChannel(PushChannel):
    """企业微信机器人 Webhook channel."""

    name = "wecom"

    def __init__(self, webhook_url: str = ""):
        self.webhook_url = webhook_url

    def is_configured(self) -> bool:
        return bool(self.webhook_url and self.webhook_url.startswith("https://qyapi.weixin.qq.com"))

    async def send(self, title: str, content: str) -> bool:
        if not self.is_configured():
            return False
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    self.webhook_url,
                    json={
                        "msgtype": "markdown",
                        "markdown": {
                            "content": f"## {title}\n\n{content[:4000]}\n\n> 由 Trade Dashboard 自动生成"
                        },
                    },
                )
                result = resp.json()
                ok = result.get("errcode") == 0
                if not ok:
                    logger.warning("WeCom push failed: %s", result.get("errmsg"))
                return ok
        except Exception as exc:
            logger.error("WeCom push error: %s", exc)
            return False
