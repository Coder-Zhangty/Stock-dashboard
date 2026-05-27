from __future__ import annotations

import os
import secrets

from pydantic_settings import BaseSettings

_INSECURE_JWT_SECRETS = {
    "",
    "changeme",
    "aurora-dev-secret",
    "aurora-config-secret",
}
_INSECURE_ADMIN_PASSWORDS = {
    "",
    "changeme",
    "change-me-now",
    "admin123!",
}
_PLACEHOLDER_ADMIN_EMAILS = {
    "",
    "replace-me@example.com",
    "admin@aurora.local",
}


class Settings(BaseSettings):
    app_name: str = "Trade Dashboard"
    app_env: str = "development"
    api_prefix: str = "/api"
    port: int = 8020

    # CORS
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"

    # Database & Uploads
    database_url: str = ""
    upload_dir: str = ""

    # ── AI Provider (canonical names) ──
    ai_provider: str = "deepseek"
    ai_model: str = "deepseek-chat"
    ai_base_url: str = "https://api.deepseek.com/v1"
    ai_api_key: str = ""
    mock_mode: bool = False
    request_timeout: float = 60.0

    # ── Backward-compat aliases for chat service code ──
    @property
    def provider(self) -> str:
        return "mock" if self.mock_mode else self.ai_provider

    @property
    def model(self) -> str:
        return self.ai_model

    @property
    def base_url(self) -> str:
        return self.ai_base_url

    @property
    def api_key(self) -> str:
        return self.ai_api_key

    # ── JWT / Auth ──
    jwt_secret: str = "aurora-dev-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # ── Session ──
    session_cookie_name: str = "aurora_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    csrf_cookie_name: str = "aurora_csrf"
    csrf_header_name: str = "X-CSRF-Token"
    session_ttl_days: int = 30

    # ── Password ──
    password_reset_token_ttl_minutes: int = 30
    email_verification_token_ttl_hours: int = 24

    # ── Rate Limiting ──
    login_failure_threshold: int = 5
    login_lock_base_seconds: int = 60
    admin_login_failure_threshold: int = 3
    login_ip_failure_threshold: int = 10
    login_ip_lock_base_seconds: int = 120
    auth_rate_limit_window_minutes: int = 30
    register_attempt_threshold: int = 5
    register_lock_base_seconds: int = 300
    forgot_password_attempt_threshold: int = 5
    forgot_password_lock_base_seconds: int = 300
    verification_email_attempt_threshold: int = 5
    verification_email_lock_base_seconds: int = 300

    # ── CAPTCHA ──
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""
    turnstile_allowed_hostnames: str = ""
    captcha_provider: str = "mock"
    mock_captcha_token: str = "human-pass"

    # ── Upload ──
    max_upload_size_bytes: int = 10 * 1024 * 1024

    # ── Encryption ──
    config_encryption_secret: str = "aurora-config-secret"

    # ── Admin Seed ──
    admin_email: str = "replace-me@example.com"
    admin_password: str = "change-me-now"
    admin_name: str = "Administrator"

    # ── Push notifications ──
    wecom_webhook_url: str = ""
    feishu_webhook_url: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    notification_email_to: str = ""
    discord_webhook_url: str = ""
    slack_webhook_url: str = ""
    pushover_user_key: str = ""
    pushover_api_token: str = ""
    ntfy_server_url: str = ""
    ntfy_topic: str = ""
    ntfy_auth_token: str = ""
    gotify_server_url: str = ""
    gotify_app_token: str = ""
    pushplus_token: str = ""
    serverchan_send_key: str = ""

    # ── External APIs ──
    tushare_token: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    # ── Derived properties ──

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def csrf_cookie_secure(self) -> bool:
        return self.session_cookie_secure

    def generate_csrf_token(self) -> str:
        return secrets.token_urlsafe(32)

    def validate_runtime(self) -> None:
        errors: list[str] = []
        warnings: list[str] = []

        admin_password = self.admin_password.strip()
        jwt_weak = self.jwt_secret.strip().lower() in _INSECURE_JWT_SECRETS or len(self.jwt_secret.strip()) < 32
        enc_weak = (
            self.config_encryption_secret.strip().lower() in _INSECURE_JWT_SECRETS
            or len(self.config_encryption_secret.strip()) < 32
        )
        admin_weak = (
            admin_password.lower() in _INSECURE_ADMIN_PASSWORDS
            or len(admin_password) < 12
            or admin_password.lower() == admin_password
            or admin_password.upper() == admin_password
            or not any(char.isdigit() for char in admin_password)
        )

        if jwt_weak:
            msg = "JWT_SECRET is weak or missing. Set a strong secret (32+ chars)."
            if self.is_production:
                errors.append(msg)
            else:
                warnings.append(msg)
        if enc_weak:
            msg = "CONFIG_ENCRYPTION_SECRET is weak or missing."
            if self.is_production:
                errors.append(msg)
            else:
                warnings.append(msg)
        if admin_weak:
            msg = "ADMIN_PASSWORD is weak. Use 12+ chars with uppercase, lowercase, and a number."
            if self.is_production:
                errors.append(msg)
            else:
                warnings.append(msg)

        if self.is_production:
            if self.captcha_provider != "turnstile" or not self.turnstile_secret_key or not self.turnstile_site_key:
                errors.append("Production requires CAPTCHA_PROVIDER=turnstile with valid Turnstile keys.")
            if not self.turnstile_allowed_hostnames:
                errors.append("Production requires TURNSTILE_ALLOWED_HOSTNAMES.")
            if self.mock_mode:
                errors.append("Production requires MOCK_MODE=false.")
            if self.provider == "mock":
                errors.append("Production requires AI_PROVIDER to be a real provider, not mock.")
            if not self.session_cookie_secure:
                errors.append("Production requires SESSION_COOKIE_SECURE=true.")
            if not self.cors_origins or any("localhost" in o or "127.0.0.1" in o for o in self.cors_origins.split(",")):
                errors.append("Production CORS_ORIGINS must be explicitly set to non-localhost origins.")
            if self.admin_email.strip().lower() in _PLACEHOLDER_ADMIN_EMAILS:
                errors.append("ADMIN_EMAIL must be replaced with a real administrator email.")
            if not os.path.isabs(self.database_url) and self.database_url:
                errors.append("Production DATABASE_URL must be an absolute path.")

        if warnings:
            import logging
            logger = logging.getLogger("trade_dashboard.config")
            for w in warnings:
                logger.warning("Security: %s", w)

        if errors:
            raise RuntimeError("Invalid configuration:\n- " + "\n- ".join(errors))


settings = Settings()
