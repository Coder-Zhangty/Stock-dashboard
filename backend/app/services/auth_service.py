from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
import uuid

from fastapi import HTTPException, status

from app.core.config import Settings
from app.core.database import get_db
from app.core.security import create_session_token, hash_opaque_token, hash_password, verify_password
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    SessionUser,
    UserSessionItem,
)
from app.services.auth_rate_limit_service import AuthRateLimitService
from app.services.audit_log_service import AuditLogService
from app.services.security_event_service import SecurityEventService
from app.services.user_governance_service import UserGovernanceService


class AuthService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.user_governance = UserGovernanceService(settings)
        self.audit_logs = AuditLogService(settings)
        self.security_events = SecurityEventService(settings)
        self.rate_limits = AuthRateLimitService(settings)
        self.ensure_seed_admin()

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @classmethod
    def _now_iso(cls) -> str:
        return cls._now().isoformat()

    @staticmethod
    def _hash_token(token: str) -> str:
        return hash_opaque_token(token)

    @staticmethod
    def _row_to_user(row) -> SessionUser | None:
        if row is None:
            return None
        return SessionUser(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            role=row["role"],
            status=row["status"],
            created_at=row["created_at"],
            password_reset_required=bool(row["password_reset_required"]) if "password_reset_required" in row.keys() else False,
            last_login_at=row["last_login_at"] if "last_login_at" in row.keys() else None,
            last_active_at=row["last_active_at"] if "last_active_at" in row.keys() else None,
            email_verified_at=row["email_verified_at"] if "email_verified_at" in row.keys() else None,
            mfa_enabled=bool(row["mfa_enabled"]) if "mfa_enabled" in row.keys() else False,
        )

    def ensure_seed_admin(self) -> None:
        with get_db() as connection:
            admin_count = connection.execute(
                """
                SELECT COUNT(*) AS admin_count
                FROM users
                WHERE role = 'admin' AND deleted_at IS NULL
                """
            ).fetchone()
            if admin_count is not None and int(admin_count["admin_count"] or 0) > 0:
                return
            existing = connection.execute(
                """
                SELECT id, password_hash
                FROM users
                WHERE email = ? AND deleted_at IS NULL
                """,
                (self.settings.admin_email.lower(),),
            ).fetchone()
            if not existing:
                password_reset_required = 1 if self.settings.is_production else 0
                connection.execute(
                    """
                    INSERT INTO users (
                        id, name, email, password_hash, role, status, created_at, updated_at,
                        password_reset_required, last_login_at, last_active_at, email_verified_at,
                        mfa_enabled, failed_login_count
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, 0)
                    """,
                    (
                        "aurora-admin",
                        self.settings.admin_name,
                        self.settings.admin_email.lower(),
                        hash_password(self.settings.admin_password),
                        "admin",
                        "active",
                        self._now_iso(),
                        self._now_iso(),
                        password_reset_required,
                        self._now_iso(),
                    ),
                )
        self.user_governance.ensure_user_controls("aurora-admin")

    def _base_user_query(self) -> str:
        return """
            SELECT id, name, email, role, status, created_at, password_reset_required,
                   last_login_at, last_active_at, email_verified_at, mfa_enabled,
                   failed_login_count, locked_until, password_hash
            FROM users
            WHERE deleted_at IS NULL
        """

    def _get_user_row_by_id(self, user_id: str):
        with get_db() as connection:
            return connection.execute(
                f"{self._base_user_query()} AND id = ?",
                (user_id,),
            ).fetchone()

    def get_user_by_id(self, user_id: str) -> SessionUser | None:
        return self._row_to_user(self._get_user_row_by_id(user_id))

    def list_users(self) -> list[SessionUser]:
        with get_db() as connection:
            rows = connection.execute(
                f"{self._base_user_query()} ORDER BY datetime(created_at) DESC, email ASC"
            ).fetchall()
        return [user for row in rows if (user := self._row_to_user(row)) is not None]

    def _get_user_row_by_email(self, email: str):
        with get_db() as connection:
            return connection.execute(
                f"{self._base_user_query()} AND email = ?",
                (email.lower(),),
            ).fetchone()

    def _reset_failed_logins(self, user_id: str) -> None:
        with get_db() as connection:
            connection.execute(
                """
                UPDATE users
                SET failed_login_count = 0, locked_until = NULL, updated_at = ?
                WHERE id = ?
                """,
                (self._now_iso(), user_id),
            )

    def _register_login_failure(
        self,
        *,
        row,
        email: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[bool, int]:
        now = self._now()
        current_count = int(row["failed_login_count"] or 0) + 1 if row is not None else 1
        role = row["role"] if row is not None else "user"
        threshold = (
            self.settings.admin_login_failure_threshold
            if role == "admin"
            else self.settings.login_failure_threshold
        )
        should_lock = current_count >= threshold
        cooldown_seconds = 0
        if should_lock:
            cooldown_multiplier = max(1, current_count - threshold + 1)
            cooldown_seconds = self.settings.login_lock_base_seconds * cooldown_multiplier
            locked_until = (now + timedelta(seconds=cooldown_seconds)).isoformat()
            with get_db() as connection:
                if row is not None:
                    connection.execute(
                        """
                        UPDATE users
                        SET failed_login_count = ?, locked_until = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (current_count, locked_until, now.isoformat(), row["id"]),
                    )
        elif row is not None:
            with get_db() as connection:
                connection.execute(
                    """
                    UPDATE users
                    SET failed_login_count = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (current_count, now.isoformat(), row["id"]),
                )
        self.security_events.record(
            actor_user_id=row["id"] if row is not None else None,
            email=email,
            action_type="auth.login_failed",
            ip_address=ip_address,
            user_agent=user_agent,
            result="failed",
            detail={"failedLoginCount": current_count, "cooldownSeconds": cooldown_seconds},
        )
        return should_lock, current_count

    def requires_captcha_for_login(self, email: str) -> bool:
        row = self._get_user_row_by_email(email)
        if row is None:
            return False
        threshold = (
            self.settings.admin_login_failure_threshold
            if row["role"] == "admin"
            else self.settings.login_failure_threshold
        )
        return row["role"] == "admin" or int(row["failed_login_count"] or 0) >= max(1, threshold - 1)

    def login(
        self,
        payload: LoginRequest,
        *,
        ip_address: str | None,
        user_agent: str | None,
    ) -> SessionUser:
        row = self._get_user_row_by_email(payload.email)
        self.rate_limits.assert_not_limited(
            scope_type="ip",
            scope_key=ip_address,
            action_type="login",
        )
        locked_until = row["locked_until"] if row is not None and "locked_until" in row.keys() else None
        if locked_until and datetime.fromisoformat(locked_until) > self._now():
            self.security_events.record(
                actor_user_id=row["id"],
                email=payload.email,
                action_type="auth.login_blocked",
                ip_address=ip_address,
                user_agent=user_agent,
                result="blocked",
                detail={"lockedUntil": locked_until},
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
            )

        if row is None or not verify_password(payload.password, row["password_hash"]):
            ip_count, ip_cooldown_seconds = self.rate_limits.register_attempt(
                scope_type="ip",
                scope_key=ip_address,
                action_type="login",
                threshold=self.settings.login_ip_failure_threshold,
                cooldown_base_seconds=self.settings.login_ip_lock_base_seconds,
            )
            self._register_login_failure(
                row=row,
                email=payload.email.lower(),
                ip_address=ip_address,
                user_agent=user_agent,
            )
            if ip_cooldown_seconds > 0:
                self.security_events.record(
                    actor_user_id=row["id"] if row is not None else None,
                    email=payload.email.lower(),
                    action_type="auth.login_ip_limited",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    result="blocked",
                    detail={
                        "failedLoginCount": ip_count,
                        "cooldownSeconds": ip_cooldown_seconds,
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if row["status"] not in {"active", "pending"}:
            self.security_events.record(
                actor_user_id=row["id"],
                email=row["email"],
                action_type="auth.login_denied",
                ip_address=ip_address,
                user_agent=user_agent,
                result="failed",
                detail={"status": row["status"]},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        now_iso = self._now_iso()
        with get_db() as connection:
            connection.execute(
                """
                UPDATE users
                SET failed_login_count = 0,
                    locked_until = NULL,
                    last_login_at = ?,
                    last_active_at = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (now_iso, now_iso, now_iso, row["id"]),
            )
            updated = connection.execute(
                f"{self._base_user_query()} AND id = ?",
                (row["id"],),
            ).fetchone()
        user = self._row_to_user(updated)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        self.user_governance.ensure_user_controls(user.id)
        self.audit_logs.record(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action_type="auth.login",
            target_type="user",
            target_id=user.id,
            target_label=user.email,
            detail="User logged in.",
            result="success",
            email=user.email,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.security_events.record(
            actor_user_id=user.id,
            email=user.email,
            action_type="auth.login_success",
            ip_address=ip_address,
            user_agent=user_agent,
            result="success",
            detail={"role": user.role},
        )
        self.rate_limits.clear(scope_type="ip", scope_key=ip_address, action_type="login")
        return user

    def register(
        self,
        payload: RegisterRequest,
        *,
        ip_address: str | None,
        user_agent: str | None,
    ) -> SessionUser:
        email = payload.email.lower()
        self.rate_limits.assert_not_limited(scope_type="ip", scope_key=ip_address, action_type="register")
        if payload.password != payload.confirm_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")
        with get_db() as connection:
            existing = connection.execute(
                "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
                (email,),
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Unable to create account.",
                )
            user_id = uuid.uuid4().hex
            created_at = self._now_iso()
            connection.execute(
                """
                INSERT INTO users (
                    id, name, email, password_hash, role, status, created_at, updated_at,
                    password_reset_required, last_login_at, last_active_at, email_verified_at,
                    mfa_enabled, failed_login_count
                )
                VALUES (?, ?, ?, ?, 'user', 'pending', ?, ?, 0, NULL, NULL, NULL, 0, 0)
                """,
                (
                    user_id,
                    payload.name.strip(),
                    email,
                    hash_password(payload.password),
                    created_at,
                    created_at,
                ),
            )
        self.user_governance.ensure_user_controls(user_id)
        user = self.get_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=500, detail="Unable to create account.")
        self.audit_logs.record(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action_type="auth.register",
            target_type="user",
            target_id=user.id,
            target_label=user.email,
            detail="New account registered.",
            email=user.email,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.security_events.record(
            actor_user_id=user.id,
            email=user.email,
            action_type="auth.register",
            ip_address=ip_address,
            user_agent=user_agent,
            result="success",
            detail={"status": "pending"},
        )
        self.rate_limits.clear(scope_type="ip", scope_key=ip_address, action_type="register")
        self.create_email_verification_token(user.id)
        return user

    def create_user(
        self,
        *,
        name: str,
        email: str,
        password: str,
        role: str = "user",
    ) -> SessionUser:
        if role == "user":
            return self.register(
                RegisterRequest(
                    name=name,
                    email=email,
                    password=password,
                    confirm_password=password,
                ),
                ip_address=None,
                user_agent="admin-create",
            )

        email_normalized = email.lower()
        with get_db() as connection:
            existing = connection.execute(
                "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
                (email_normalized,),
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email is already in use.",
                )
            user_id = uuid.uuid4().hex
            created_at = self._now_iso()
            connection.execute(
                """
                INSERT INTO users (
                    id, name, email, password_hash, role, status, created_at, updated_at,
                    password_reset_required, email_verified_at, mfa_enabled, failed_login_count
                )
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, 0, 0)
                """,
                (
                    user_id,
                    name.strip(),
                    email_normalized,
                    hash_password(password),
                    role,
                    created_at,
                    created_at,
                    created_at,
                ),
            )
        self.user_governance.ensure_user_controls(user_id)
        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def _create_session_record(
        self,
        *,
        user_id: str,
        user_agent: str | None,
        ip_address: str | None,
    ) -> tuple[str, str]:
        token = create_session_token()
        session_id = uuid.uuid4().hex
        now_iso = self._now_iso()
        expires_at = (self._now() + timedelta(days=self.settings.session_ttl_days)).isoformat()
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO user_sessions (
                    id, user_id, refresh_token_hash, session_token_hash, user_agent,
                    ip_address, expires_at, created_at, revoked_at, last_seen_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                """,
                (
                    session_id,
                    user_id,
                    self._hash_token(token),
                    self._hash_token(token),
                    user_agent,
                    ip_address,
                    expires_at,
                    now_iso,
                    now_iso,
                ),
            )
        return token, session_id

    def create_session(
        self,
        *,
        user_id: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> str:
        token, _ = self._create_session_record(
            user_id=user_id,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        return token

    def create_refresh_session(self, *, user_id: str, user_agent: str | None = None, ip_address: str | None = None) -> str:
        return self.create_session(user_id=user_id, user_agent=user_agent, ip_address=ip_address)

    def get_user_from_session_token(self, token: str, *, touch: bool = True) -> SessionUser | None:
        with get_db() as connection:
            session = connection.execute(
                """
                SELECT user_id, id
                FROM user_sessions
                WHERE session_token_hash = ?
                  AND revoked_at IS NULL
                  AND datetime(expires_at) >= datetime(?)
                ORDER BY datetime(created_at) DESC
                LIMIT 1
                """,
                (self._hash_token(token), self._now_iso()),
            ).fetchone()
            if session is None:
                return None
            if touch:
                connection.execute(
                    "UPDATE user_sessions SET last_seen_at = ? WHERE id = ?",
                    (self._now_iso(), session["id"]),
                )
                connection.execute(
                    "UPDATE users SET last_active_at = ?, updated_at = ? WHERE id = ?",
                    (self._now_iso(), self._now_iso(), session["user_id"]),
                )
        user = self.get_user_by_id(session["user_id"])
        if user and user.status in {"active", "pending"}:
            return user
        return None

    def refresh_user_from_token(self, refresh_token: str) -> SessionUser:
        user = self.get_user_from_session_token(refresh_token)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid.")
        return user

    def revoke_refresh_session(self, refresh_token: str) -> None:
        self.revoke_session(refresh_token)

    def revoke_session(self, session_token: str) -> None:
        with get_db() as connection:
            connection.execute(
                """
                UPDATE user_sessions
                SET revoked_at = ?
                WHERE session_token_hash = ? AND revoked_at IS NULL
                """,
                (self._now_iso(), self._hash_token(session_token)),
            )

    def rotate_session(
        self,
        *,
        current_session_token: str | None,
        user_id: str,
        user_agent: str | None,
        ip_address: str | None,
    ) -> str:
        if current_session_token:
            self.revoke_session(current_session_token)
        return self.create_session(user_id=user_id, user_agent=user_agent, ip_address=ip_address)

    def list_sessions(self, *, user_id: str, current_token: str | None) -> list[UserSessionItem]:
        current_hash = self._hash_token(current_token) if current_token else None
        with get_db() as connection:
            rows = connection.execute(
                """
                SELECT id, session_token_hash, user_agent, ip_address, created_at,
                       expires_at, revoked_at, last_seen_at
                FROM user_sessions
                WHERE user_id = ?
                ORDER BY datetime(created_at) DESC
                """,
                (user_id,),
            ).fetchall()
        return [
            UserSessionItem(
                id=row["id"],
                user_agent=row["user_agent"],
                ip_address=row["ip_address"],
                created_at=row["created_at"],
                expires_at=row["expires_at"],
                revoked_at=row["revoked_at"],
                last_seen_at=row["last_seen_at"],
                current=bool(current_hash and row["session_token_hash"] == current_hash),
            )
            for row in rows
        ]

    def revoke_other_sessions(self, *, user_id: str, current_token: str | None) -> None:
        current_hash = self._hash_token(current_token) if current_token else None
        with get_db() as connection:
            if current_hash:
                connection.execute(
                    """
                    UPDATE user_sessions
                    SET revoked_at = ?
                    WHERE user_id = ? AND revoked_at IS NULL AND session_token_hash != ?
                    """,
                    (self._now_iso(), user_id, current_hash),
                )
            else:
                connection.execute(
                    """
                    UPDATE user_sessions
                    SET revoked_at = ?
                    WHERE user_id = ? AND revoked_at IS NULL
                    """,
                    (self._now_iso(), user_id),
                )

    def revoke_all_sessions_for_user(self, *, user_id: str) -> None:
        with get_db() as connection:
            connection.execute(
                """
                UPDATE user_sessions
                SET revoked_at = ?
                WHERE user_id = ? AND revoked_at IS NULL
                """,
                (self._now_iso(), user_id),
            )

    def set_user_status(self, user_id: str, status_value: str) -> SessionUser | None:
        if user_id == "aurora-admin" and status_value != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The seed administrator account cannot be disabled.",
            )
        with get_db() as connection:
            connection.execute(
                "UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
                (status_value, self._now_iso(), user_id),
            )
            row = connection.execute(
                f"{self._base_user_query()} AND id = ?",
                (user_id,),
            ).fetchone()
        return self._row_to_user(row)

    def reset_password(self, user_id: str, new_password: str) -> SessionUser | None:
        with get_db() as connection:
            connection.execute(
                """
                UPDATE users
                SET password_hash = ?, password_reset_required = 0, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (hash_password(new_password), self._now_iso(), user_id),
            )
        self.revoke_all_sessions_for_user(user_id=user_id)
        return self.get_user_by_id(user_id)

    def change_password(
        self,
        *,
        user_id: str,
        current_password: str,
        new_password: str,
    ) -> SessionUser:
        row = self._get_user_row_by_id(user_id)
        if row is None or not verify_password(current_password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )
        with get_db() as connection:
            connection.execute(
                """
                UPDATE users
                SET password_hash = ?, password_reset_required = 0, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (hash_password(new_password), self._now_iso(), user_id),
            )
        self.revoke_all_sessions_for_user(user_id=user_id)
        user = self.get_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def create_password_reset_token(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        token_hash = hash_opaque_token(token)
        expires_at = (self._now() + timedelta(minutes=self.settings.password_reset_token_ttl_minutes)).isoformat()
        with get_db() as connection:
            connection.execute(
                "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
                (self._now_iso(), user_id),
            )
            connection.execute(
                """
                INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
                VALUES (?, ?, ?, ?, NULL, ?)
                """,
                (uuid.uuid4().hex, user_id, token_hash, expires_at, self._now_iso()),
            )
        return token

    def consume_password_reset_token(self, token: str, new_password: str) -> SessionUser:
        token_hash = hash_opaque_token(token)
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT id, user_id, expires_at, used_at
                FROM password_reset_tokens
                WHERE token_hash = ?
                ORDER BY datetime(created_at) DESC
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()
            if row is None or row["used_at"] is not None or datetime.fromisoformat(row["expires_at"]) < self._now():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reset token is invalid or expired.",
                )
            connection.execute(
                "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
                (self._now_iso(), row["id"]),
            )
            connection.execute(
                """
                UPDATE users
                SET password_hash = ?, password_reset_required = 0, updated_at = ?
                WHERE id = ?
                """,
                (hash_password(new_password), self._now_iso(), row["user_id"]),
            )
        self.revoke_all_sessions_for_user(user_id=row["user_id"])
        user = self.get_user_by_id(row["user_id"])
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def create_email_verification_token(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        token_hash = hash_opaque_token(token)
        expires_at = (self._now() + timedelta(hours=self.settings.email_verification_token_ttl_hours)).isoformat()
        with get_db() as connection:
            connection.execute(
                "UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
                (self._now_iso(), user_id),
            )
            connection.execute(
                """
                INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
                VALUES (?, ?, ?, ?, NULL, ?)
                """,
                (uuid.uuid4().hex, user_id, token_hash, expires_at, self._now_iso()),
            )
        return token

    def consume_email_verification_token(self, token: str) -> SessionUser:
        token_hash = hash_opaque_token(token)
        with get_db() as connection:
            row = connection.execute(
                """
                SELECT id, user_id, expires_at, used_at
                FROM email_verification_tokens
                WHERE token_hash = ?
                ORDER BY datetime(created_at) DESC
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()
            if row is None or row["used_at"] is not None or datetime.fromisoformat(row["expires_at"]) < self._now():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification token is invalid or expired.",
                )
            connection.execute(
                "UPDATE email_verification_tokens SET used_at = ? WHERE id = ?",
                (self._now_iso(), row["id"]),
            )
            connection.execute(
                """
                UPDATE users
                SET email_verified_at = ?, status = CASE WHEN status = 'pending' THEN 'active' ELSE status END, updated_at = ?
                WHERE id = ?
                """,
                (self._now_iso(), self._now_iso(), row["user_id"]),
            )
        user = self.get_user_by_id(row["user_id"])
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def touch_user_activity(self, user_id: str) -> None:
        with get_db() as connection:
            connection.execute(
                "UPDATE users SET last_active_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
                (self._now_iso(), self._now_iso(), user_id),
            )

    def delete_user(self, user_id: str) -> bool:
        if user_id == "aurora-admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The seed administrator account cannot be deleted.",
            )
        with get_db() as connection:
            now = self._now_iso()
            cursor = connection.execute(
                """
                UPDATE users
                SET deleted_at = ?, updated_at = ?, status = 'disabled'
                WHERE id = ? AND deleted_at IS NULL
                """,
                (now, now, user_id),
            )
            changed = cursor.rowcount > 0
        if changed:
            self.revoke_all_sessions_for_user(user_id=user_id)
        return changed
