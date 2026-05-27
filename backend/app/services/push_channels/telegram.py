from __future__ import annotations

import logging
import httpx

from app.services.push_channels.base import PushChannel

logger = logging.getLogger(__name__)


class TelegramChannel(PushChannel):
    """Telegram Bot channel."""

    name = "telegram"

    def __init__(self, bot_token: str = "", chat_id: str = ""):
        self.bot_token = bot_token
        self.chat_id = chat_id

    def is_configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    async def send(self, title: str, content: str) -> bool:
        if not self.is_configured():
            return False
        try:
            text = f"*{title}*\n\n{content[:3800]}\n\n_由 Trade Dashboard 自动生成_"
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": text,
                        "parse_mode": "Markdown",
                    },
                )
                result = resp.json()
                ok = result.get("ok") is True
                if not ok:
                    logger.warning("Telegram push failed: %s", result.get("description"))
                return ok
        except Exception as exc:
            logger.error("Telegram push error: %s", exc)
            return False
