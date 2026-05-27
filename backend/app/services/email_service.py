from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.database import get_connection
from app.services.push_channels.email import EmailChannel

logger = logging.getLogger(__name__)

TOKEN_EXPIRY_HOURS = 24


def _ensure_table():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS email_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            token_type TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_tokens(token)
    """)
    conn.commit()
    conn.close()


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def create_token(user_id: int, email: str, token_type: str) -> str:
    _ensure_table()
    token = generate_token()
    expires = (datetime.now() + timedelta(hours=TOKEN_EXPIRY_HOURS)).isoformat()
    conn = get_connection()
    conn.execute(
        "INSERT INTO email_tokens (user_id, email, token, token_type, expires_at) VALUES (?,?,?,?,?)",
        (user_id, email, token, token_type, expires),
    )
    conn.commit()
    conn.close()
    return token


def verify_token(token: str, token_type: str) -> dict | None:
    _ensure_table()
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM email_tokens WHERE token=? AND token_type=? AND used=0",
        (token, token_type),
    ).fetchone()
    if not row:
        conn.close()
        return None
    expires = datetime.fromisoformat(row["expires_at"])
    if datetime.now() > expires:
        conn.close()
        return None
    conn.execute(
        "UPDATE email_tokens SET used=1 WHERE id=?",
        (row["id"],),
    )
    conn.commit()
    conn.close()
    return dict(row)


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send email via configured SMTP."""
    channel = EmailChannel(settings)
    try:
        await channel.send(subject, html_body, to_email=to)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


async def send_password_reset(user_id: int, email: str, username: str) -> bool:
    """Generate and send password reset email."""
    token = create_token(user_id, email, "password_reset")
    reset_url = f"{settings.cors_origins.split(',')[0].strip()}/reset-password?token={token}"
    html = f"""
    <h2>密码重置</h2>
    <p>您好 {username}，</p>
    <p>点击下方链接重置您的 Trade Dashboard 密码（24小时内有效）：</p>
    <p><a href="{reset_url}">{reset_url}</a></p>
    <p>如果您未请求此操作，请忽略此邮件。</p>
    """
    return await send_email(email, "Trade Dashboard - 密码重置", html)


async def send_email_verification(user_id: int, email: str, username: str) -> bool:
    """Generate and send email verification."""
    token = create_token(user_id, email, "email_verify")
    verify_url = f"{settings.cors_origins.split(',')[0].strip()}/verify-email?token={token}"
    html = f"""
    <h2>邮箱验证</h2>
    <p>您好 {username}，</p>
    <p>点击下方链接验证您的 Trade Dashboard 邮箱（24小时内有效）：</p>
    <p><a href="{verify_url}">{verify_url}</a></p>
    <p>如果您未注册此账号，请忽略此邮件。</p>
    """
    return await send_email(email, "Trade Dashboard - 邮箱验证", html)
