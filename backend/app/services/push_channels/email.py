from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.services.push_channels.base import PushChannel

logger = logging.getLogger(__name__)


class EmailChannel(PushChannel):
    """SMTP Email channel."""

    name = "email"

    def __init__(
        self,
        smtp_host: str = "",
        smtp_port: int = 587,
        username: str = "",
        password: str = "",
        to_emails: str = "",
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.to_emails = to_emails

    def is_configured(self) -> bool:
        return bool(self.smtp_host and self.username and self.password and self.to_emails)

    async def send(self, title: str, content: str) -> bool:
        if not self.is_configured():
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = title
            msg["From"] = self.username
            msg["To"] = self.to_emails
            html = f"""<html><body>
<h2>{title}</h2>
<div>{content.replace(chr(10), '<br>')}</div>
<hr><small>由 Trade Dashboard 自动生成</small>
</body></html>"""
            msg.attach(MIMEText(html, "html", "utf-8"))

            server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15)
            server.starttls()
            server.login(self.username, self.password)
            server.sendmail(self.username, self.to_emails.split(","), msg.as_string())
            server.quit()
            return True
        except Exception as exc:
            logger.error("Email push error: %s", exc)
            return False
