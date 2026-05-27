from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import get_current_session_token, get_current_user, get_optional_user, verify_csrf
from app.core.config import settings as app_settings
from app.core.security import verify_password
from app.schemas.auth import (
    AuthResponse,
    AuthStatusResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    HumanVerificationConfig,
    LoginRequest,
    PasswordResetTokenResponse,
    RegisterRequest,
    ResetPasswordRequest,
    RevokeOtherSessionsRequest,
    SendVerificationEmailRequest,
    SessionUser,
    UserSessionsResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import AuthService
from app.services.auth_rate_limit_service import AuthRateLimitService
from app.services.captcha_service import CaptchaService
from app.services.security_event_service import SecurityEventService

router = APIRouter(prefix="/auth")


def _set_session_cookie(response: Response, settings: Settings, session_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        path="/",
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


def _set_csrf_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=token,
        httponly=False,
        secure=settings.csrf_cookie_secure,
        samesite=settings.session_cookie_samesite,
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        path="/",
    )


def _clear_csrf_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        path="/",
        secure=settings.csrf_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


def _auth_payload(user: SessionUser) -> AuthResponse:
    return AuthResponse(
        user=user,
        password_reset_required=user.password_reset_required,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> AuthResponse:
    service = AuthService(settings)
    captcha = CaptchaService(settings)
    if service.requires_captcha_for_login(payload.email):
        try:
            await captcha.verify_or_raise(
                token=payload.captcha_token,
                remote_ip=request.client.host if request.client else None,
                action="login",
            )
        except Exception:
            rate_limits = AuthRateLimitService(settings)
            ip_count, ip_cooldown_seconds = rate_limits.register_attempt(
                scope_type="ip",
                scope_key=request.client.host if request.client else None,
                action_type="login",
                threshold=settings.login_ip_failure_threshold,
                cooldown_base_seconds=settings.login_ip_lock_base_seconds,
            )
            SecurityEventService(settings).record(
                actor_user_id=None,
                email=payload.email,
                action_type="auth.captcha_failed",
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                result="failed",
                detail={
                    "action": "login",
                    "ipAttemptCount": ip_count,
                    "ipCooldownSeconds": ip_cooldown_seconds,
                },
            )
            raise
    user = service.login(
        payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    session_token = service.create_session(
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookie(response, settings, session_token)
    _set_csrf_cookie(response, settings, settings.generate_csrf_token())
    return _auth_payload(user)


@router.post("/register", response_model=AuthResponse)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> AuthResponse:
    rate_limits = AuthRateLimitService(settings)
    rate_limits.assert_not_limited(
        scope_type="ip",
        scope_key=request.client.host if request.client else None,
        action_type="register",
    )
    captcha = CaptchaService(settings)
    try:
        await captcha.verify_or_raise(
            token=payload.captcha_token,
            remote_ip=request.client.host if request.client else None,
            action="register",
        )
    except Exception:
        count, cooldown_seconds = rate_limits.register_attempt(
            scope_type="ip",
            scope_key=request.client.host if request.client else None,
            action_type="register",
            threshold=settings.register_attempt_threshold,
            cooldown_base_seconds=settings.register_lock_base_seconds,
        )
        SecurityEventService(settings).record(
            actor_user_id=None,
            email=payload.email,
            action_type="auth.captcha_failed",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            result="failed",
            detail={"action": "register", "attemptCount": count, "cooldownSeconds": cooldown_seconds},
        )
        raise
    service = AuthService(settings)
    user = service.register(
        payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    rate_limits.register_attempt(
        scope_type="ip",
        scope_key=request.client.host if request.client else None,
        action_type="register",
        threshold=settings.register_attempt_threshold,
        cooldown_base_seconds=settings.register_lock_base_seconds,
    )
    session_token = service.create_session(
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookie(response, settings, session_token)
    _set_csrf_cookie(response, settings, settings.generate_csrf_token())
    return _auth_payload(user)


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    session_token: str | None = Depends(get_current_session_token),
    user: SessionUser | None = Depends(get_optional_user),
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    service = AuthService(settings)
    if session_token:
        service.revoke_session(session_token)
    if user:
        SecurityEventService(settings).record(
            actor_user_id=user.id,
            email=user.email,
            action_type="auth.logout",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            result="success",
            detail={"role": user.role},
        )
    _clear_session_cookie(response, settings)
    _clear_csrf_cookie(response, settings)
    return {"success": True}


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    request: Request,
    response: Response,
    session_token: str | None = Depends(get_current_session_token),
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> AuthResponse:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    service = AuthService(settings)
    user = service.refresh_user_from_token(session_token)
    rotated = service.rotate_session(
        current_session_token=session_token,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookie(response, settings, rotated)
    _set_csrf_cookie(response, settings, settings.generate_csrf_token())
    return _auth_payload(user)


@router.get("/session", response_model=AuthStatusResponse)
def get_session(
    response: Response,
    user: SessionUser | None = Depends(get_optional_user),
    settings = Depends(lambda: app_settings),
) -> AuthStatusResponse:
    _set_csrf_cookie(response, settings, settings.generate_csrf_token())
    return AuthStatusResponse(
        authenticated=user is not None,
        user=user,
        security=HumanVerificationConfig(**CaptchaService(settings).get_frontend_config()),
    )


@router.get("/me", response_model=SessionUser)
def me(user: SessionUser = Depends(get_current_user)) -> SessionUser:
    return user


@router.post("/change-password", response_model=AuthResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: SessionUser = Depends(get_current_user),
    session_token: str | None = Depends(get_current_session_token),
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> AuthResponse:
    rate_limits = AuthRateLimitService(settings)
    rate_limits.assert_not_limited(scope_type="user", scope_key=user.id, action_type="change_password")
    service = AuthService(settings)
    updated = service.change_password(
        user_id=user.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    if not payload.revoke_other_sessions:
        rotated = service.rotate_session(
            current_session_token=session_token,
            user_id=updated.id,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    else:
        rotated = service.create_session(
            user_id=updated.id,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    _set_session_cookie(response, settings, rotated)
    _set_csrf_cookie(response, settings, settings.generate_csrf_token())
    SecurityEventService(settings).record(
        actor_user_id=updated.id,
        email=updated.email,
        action_type="auth.change_password",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        result="success",
        detail={"revokeOtherSessions": payload.revoke_other_sessions},
    )
    return _auth_payload(updated)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> ForgotPasswordResponse:
    rate_limits = AuthRateLimitService(settings)
    client_ip = request.client.host if request.client else None
    rate_limits.assert_not_limited(scope_type="ip", scope_key=client_ip, action_type="forgot_password")
    rate_limits.assert_not_limited(scope_type="account", scope_key=payload.email, action_type="forgot_password")
    captcha = CaptchaService(settings)
    try:
        await captcha.verify_or_raise(
            token=payload.captcha_token,
            remote_ip=request.client.host if request.client else None,
            action="forgot_password",
        )
    except Exception:
        ip_count, ip_cooldown_seconds = rate_limits.register_attempt(
            scope_type="ip",
            scope_key=client_ip,
            action_type="forgot_password",
            threshold=settings.forgot_password_attempt_threshold,
            cooldown_base_seconds=settings.forgot_password_lock_base_seconds,
        )
        account_count, account_cooldown_seconds = rate_limits.register_attempt(
            scope_type="account",
            scope_key=payload.email,
            action_type="forgot_password",
            threshold=settings.forgot_password_attempt_threshold,
            cooldown_base_seconds=settings.forgot_password_lock_base_seconds,
        )
        SecurityEventService(settings).record(
            actor_user_id=None,
            email=payload.email,
            action_type="auth.captcha_failed",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            result="failed",
            detail={
                "action": "forgot_password",
                "ipAttemptCount": ip_count,
                "ipCooldownSeconds": ip_cooldown_seconds,
                "accountAttemptCount": account_count,
                "accountCooldownSeconds": account_cooldown_seconds,
            },
        )
        raise
    service = AuthService(settings)
    user = service._get_user_row_by_email(payload.email.lower())
    if user is not None:
        service.create_password_reset_token(user["id"])
        SecurityEventService(settings).record(
            actor_user_id=user["id"],
            email=payload.email,
            action_type="auth.forgot_password_requested",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            result="success",
            detail={},
        )
    rate_limits.register_attempt(
        scope_type="ip",
        scope_key=client_ip,
        action_type="forgot_password",
        threshold=settings.forgot_password_attempt_threshold,
        cooldown_base_seconds=settings.forgot_password_lock_base_seconds,
    )
    rate_limits.register_attempt(
        scope_type="account",
        scope_key=payload.email,
        action_type="forgot_password",
        threshold=settings.forgot_password_attempt_threshold,
        cooldown_base_seconds=settings.forgot_password_lock_base_seconds,
    )
    return ForgotPasswordResponse(
        message="If that email can receive reset instructions, it will receive them shortly.",
    )


@router.post("/reset-password", response_model=PasswordResetTokenResponse)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> PasswordResetTokenResponse:
    rate_limits = AuthRateLimitService(settings)
    ip = request.client.host if request.client else None
    rate_limits.assert_not_limited(scope_type="ip", scope_key=ip, action_type="reset_password")
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")
    user = AuthService(settings).consume_password_reset_token(payload.token, payload.password)
    SecurityEventService(settings).record(
        actor_user_id=user.id,
        email=user.email,
        action_type="auth.password_reset",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        result="success",
        detail={},
    )
    return PasswordResetTokenResponse(message="Password has been reset successfully.")


@router.post("/send-verification-email", response_model=ForgotPasswordResponse)
async def send_verification_email(
    payload: SendVerificationEmailRequest,
    request: Request,
    user: SessionUser = Depends(get_current_user),
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> ForgotPasswordResponse:
    rate_limits = AuthRateLimitService(settings)
    client_ip = request.client.host if request.client else None
    rate_limits.assert_not_limited(scope_type="ip", scope_key=client_ip, action_type="send_verification_email")
    if payload.captcha_token:
        try:
            await CaptchaService(settings).verify_or_raise(
                token=payload.captcha_token,
                remote_ip=client_ip,
                action="send_verification_email",
            )
        except Exception:
            count, cooldown_seconds = rate_limits.register_attempt(
                scope_type="ip",
                scope_key=client_ip,
                action_type="send_verification_email",
                threshold=settings.verification_email_attempt_threshold,
                cooldown_base_seconds=settings.verification_email_lock_base_seconds,
            )
            SecurityEventService(settings).record(
                actor_user_id=user.id,
                email=user.email,
                action_type="auth.captcha_failed",
                ip_address=client_ip,
                user_agent=request.headers.get("user-agent"),
                result="failed",
                detail={
                    "action": "send_verification_email",
                    "attemptCount": count,
                    "cooldownSeconds": cooldown_seconds,
                },
            )
            raise
    AuthService(settings).create_email_verification_token(user.id)
    rate_limits.register_attempt(
        scope_type="ip",
        scope_key=client_ip,
        action_type="send_verification_email",
        threshold=settings.verification_email_attempt_threshold,
        cooldown_base_seconds=settings.verification_email_lock_base_seconds,
    )
    SecurityEventService(settings).record(
        actor_user_id=user.id,
        email=user.email,
        action_type="auth.send_verification_email",
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
        result="success",
        detail={},
    )
    return ForgotPasswordResponse(message="Verification instructions have been issued.")


@router.post("/verify-email", response_model=AuthResponse)
def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> AuthResponse:
    rate_limits = AuthRateLimitService(settings)
    ip = request.client.host if request.client else None
    rate_limits.assert_not_limited(scope_type="ip", scope_key=ip, action_type="verify_email")
    user = AuthService(settings).consume_email_verification_token(payload.token)
    SecurityEventService(settings).record(
        actor_user_id=user.id,
        email=user.email,
        action_type="auth.verify_email",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        result="success",
        detail={},
    )
    return _auth_payload(user)


@router.get("/sessions", response_model=UserSessionsResponse)
def list_sessions(
    user: SessionUser = Depends(get_current_user),
    current_token: str | None = Depends(get_current_session_token),
    settings = Depends(lambda: app_settings),
) -> UserSessionsResponse:
    return UserSessionsResponse(items=AuthService(settings).list_sessions(user_id=user.id, current_token=current_token))


@router.post("/sessions/revoke-others")
def revoke_other_sessions(
    payload: RevokeOtherSessionsRequest,
    request: Request,
    user: SessionUser = Depends(get_current_user),
    current_token: str | None = Depends(get_current_session_token),
    _: None = Depends(verify_csrf),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    service = AuthService(settings)
    row = service._get_user_row_by_id(user.id)
    if row is None or not row["password_hash"] or not verify_password(payload.current_password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    service.revoke_other_sessions(user_id=user.id, current_token=current_token)
    SecurityEventService(settings).record(
        actor_user_id=user.id,
        email=user.email,
        action_type="auth.revoke_other_sessions",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        result="success",
        detail={},
    )
    return {"success": True}
