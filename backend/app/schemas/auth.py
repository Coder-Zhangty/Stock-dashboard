from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


def _validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if value.lower() == value or value.upper() == value:
        raise ValueError("Password must include both uppercase and lowercase letters.")
    if not any(char.isdigit() for char in value):
        raise ValueError("Password must include at least one number.")
    return value


def _validate_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized:
        raise ValueError("Email address is invalid.")
    local_part, _, domain = normalized.partition("@")
    if not local_part or not domain or "." not in domain:
        raise ValueError("Email address is invalid.")
    return normalized


class SessionUser(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: str
    created_at: str
    password_reset_required: bool = False
    last_login_at: str | None = None
    last_active_at: str | None = None
    email_verified_at: str | None = None
    mfa_enabled: bool = False


class HumanVerificationConfig(BaseModel):
    provider: str
    site_key: str | None = None
    mock_token_hint: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=120)
    captcha_token: str | None = Field(default=None, max_length=2048)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=120)
    confirm_password: str = Field(min_length=8, max_length=120)
    captcha_token: str | None = Field(default=None, max_length=2048)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("confirm_password")
    @classmethod
    def confirm_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, max_length=500)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=120)
    new_password: str = Field(min_length=8, max_length=120)
    revoke_other_sessions: bool = True

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class ForgotPasswordRequest(BaseModel):
    email: str
    captcha_token: str = Field(min_length=1, max_length=2048)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=500)
    password: str = Field(min_length=8, max_length=120)
    confirm_password: str = Field(min_length=8, max_length=120)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)

    @field_validator("confirm_password")
    @classmethod
    def confirm_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class SendVerificationEmailRequest(BaseModel):
    captcha_token: str | None = Field(default=None, max_length=2048)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10, max_length=500)


class RevokeOtherSessionsRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=120)


class AuthResponse(BaseModel):
    user: SessionUser
    requires_captcha: bool = False
    password_reset_required: bool = False


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: SessionUser | None = None
    security: HumanVerificationConfig | None = None


class ForgotPasswordResponse(BaseModel):
    success: bool = True
    message: str


class PasswordResetTokenResponse(BaseModel):
    success: bool = True
    message: str


class UserSessionItem(BaseModel):
    id: str
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: str
    expires_at: str
    revoked_at: str | None = None
    last_seen_at: str | None = None
    current: bool = False


class UserSessionsResponse(BaseModel):
    items: list[UserSessionItem]
