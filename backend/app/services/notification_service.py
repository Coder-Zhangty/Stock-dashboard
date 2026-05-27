from __future__ import annotations

import logging
import asyncio

from app.core.config import settings
from app.services.push_channels.wecom import WeComChannel
from app.services.push_channels.feishu import FeishuChannel
from app.services.push_channels.telegram import TelegramChannel
from app.services.push_channels.email import EmailChannel
from app.services.push_channels.discord import DiscordChannel
from app.services.push_channels.slack import SlackChannel
from app.services.push_channels.pushover import PushoverChannel
from app.services.push_channels.ntfy import NtfyChannel
from app.services.push_channels.gotify import GotifyChannel
from app.services.push_channels.pushplus import PushPlusChannel
from app.services.push_channels.serverchan import ServerChanChannel
from app.services.push_channels.base import PushChannel

logger = logging.getLogger(__name__)


class NotificationService:
    """Unified push notification service coordinating multiple channels."""

    def __init__(self):
        self.channels: list[PushChannel] = []
        self._init_channels()

    def _init_channels(self):
        wecom_url = getattr(settings, "wecom_webhook_url", "")
        feishu_url = getattr(settings, "feishu_webhook_url", "")
        tg_token = getattr(settings, "telegram_bot_token", "")
        tg_chat = getattr(settings, "telegram_chat_id", "")
        smtp_host = getattr(settings, "smtp_host", "")
        smtp_port = getattr(settings, "smtp_port", 587)
        smtp_user = getattr(settings, "smtp_username", "")
        smtp_pass = getattr(settings, "smtp_password", "")
        smtp_to = getattr(settings, "notification_email_to", "")

        if wecom_url:
            self.channels.append(WeComChannel(wecom_url))
        if feishu_url:
            self.channels.append(FeishuChannel(feishu_url))
        if tg_token and tg_chat:
            self.channels.append(TelegramChannel(tg_token, tg_chat))
        if smtp_host:
            self.channels.append(EmailChannel(smtp_host, smtp_port, smtp_user, smtp_pass, smtp_to))

        discord_url = getattr(settings, "discord_webhook_url", "")
        slack_url = getattr(settings, "slack_webhook_url", "")
        pushover_user = getattr(settings, "pushover_user_key", "")
        pushover_token = getattr(settings, "pushover_api_token", "")
        ntfy_url = getattr(settings, "ntfy_server_url", "")
        ntfy_topic = getattr(settings, "ntfy_topic", "")
        ntfy_token = getattr(settings, "ntfy_auth_token", "")
        gotify_url = getattr(settings, "gotify_server_url", "")
        gotify_token = getattr(settings, "gotify_app_token", "")
        pushplus_tok = getattr(settings, "pushplus_token", "")
        serverchan_key = getattr(settings, "serverchan_send_key", "")

        if discord_url:
            self.channels.append(DiscordChannel(discord_url))
        if slack_url:
            self.channels.append(SlackChannel(slack_url))
        if pushover_user and pushover_token:
            self.channels.append(PushoverChannel(pushover_user, pushover_token))
        if ntfy_url and ntfy_topic:
            self.channels.append(NtfyChannel(ntfy_url, ntfy_topic, ntfy_token))
        if gotify_url and gotify_token:
            self.channels.append(GotifyChannel(gotify_url, gotify_token))
        if pushplus_tok:
            self.channels.append(PushPlusChannel(pushplus_tok))
        if serverchan_key:
            self.channels.append(ServerChanChannel(serverchan_key))

        logger.info("Notification channels: %d configured", len(self.channels))

    async def broadcast(self, title: str, content: str) -> dict[str, bool]:
        """Send notification to all configured channels in parallel."""
        if not self.channels:
            return {"status": "no_channels"}
        results = await asyncio.gather(
            *(channel.send(title, content) for channel in self.channels),
            return_exceptions=True,
        )
        return {
            channel.name: (results[i] if not isinstance(results[i], Exception) else False)
            for i, channel in enumerate(self.channels)
        }

    def configured_channels(self) -> list[str]:
        return [ch.name for ch in self.channels if ch.is_configured()]


_notification_service: NotificationService | None = None


def get_notification_service() -> NotificationService:
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
