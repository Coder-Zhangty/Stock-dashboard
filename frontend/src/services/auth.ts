import type {
  AuthSession,
  AuthSessionDevice,
  AuthStatus,
} from '../types/auth'
import { requestJson } from './api'

interface SessionUserDto {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled' | 'suspended' | 'blocked' | 'pending'
  created_at: string
  password_reset_required: boolean
  email_verified_at?: string | null
  mfa_enabled?: boolean
}

interface AuthResponseDto {
  user: SessionUserDto
  requires_captcha?: boolean
  password_reset_required?: boolean
}

interface AuthStatusDto {
  authenticated: boolean
  user: SessionUserDto | null
  security?: {
    provider: string
    site_key?: string | null
    mock_token_hint?: string | null
  }
}

interface UserSessionsDto {
  items: Array<{
    id: string
    user_agent: string | null
    ip_address: string | null
    created_at: string
    expires_at: string
    revoked_at: string | null
    last_seen_at: string | null
    current: boolean
  }>
}

const toSession = (user: SessionUserDto): AuthSession => ({
  userId: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.created_at,
  accountType: user.role,
  passwordResetRequired: user.password_reset_required,
  emailVerifiedAt: user.email_verified_at ?? null,
  mfaEnabled: Boolean(user.mfa_enabled),
})

export const readStoredToken = () => null  // auth is via httpOnly session cookie — no JS-readable bearer token

export const readStoredSession = (): AuthSession | null => null

export const login = async (input: {
  email: string
  password: string
  captchaToken?: string | null
}) => {
  const response = await requestJson<AuthResponseDto>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      captcha_token: input.captchaToken ?? null,
    }),
  })
  return toSession(response.user)
}

export const register = async (input: {
  name: string
  email: string
  password: string
  confirmPassword: string
  captchaToken: string
}) => {
  const response = await requestJson<AuthResponseDto>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      confirm_password: input.confirmPassword,
      captcha_token: input.captchaToken,
    }),
  })
  return toSession(response.user)
}

export const fetchSession = async (): Promise<AuthStatus> => {
  const response = await requestJson<AuthStatusDto>('/api/auth/session')
  return {
    authenticated: response.authenticated,
    user: response.user ? toSession(response.user) : null,
    security: response.security
      ? {
          provider: response.security.provider,
          siteKey: response.security.site_key ?? null,
          mockTokenHint: response.security.mock_token_hint ?? null,
        }
      : {
          provider: 'mock',
          siteKey: null,
          mockTokenHint: null,
        },
  }
}

export const logout = async () => {
  await requestJson('/api/auth/logout', {
    method: 'POST',
  })
}

export const forgotPassword = async (input: {
  email: string
  captchaToken: string
}) => {
  return requestJson<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      captcha_token: input.captchaToken,
    }),
  })
}

export const resetPassword = async (input: {
  token: string
  password: string
  confirmPassword: string
}) => {
  return requestJson<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: input.token,
      password: input.password,
      confirm_password: input.confirmPassword,
    }),
  })
}

export const changePassword = async (input: {
  currentPassword: string
  newPassword: string
  revokeOtherSessions?: boolean
}) => {
  const response = await requestJson<AuthResponseDto>('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: input.currentPassword,
      new_password: input.newPassword,
      revoke_other_sessions: input.revokeOtherSessions ?? true,
    }),
  })
  return toSession(response.user)
}

export const sendVerificationEmail = async (captchaToken?: string | null) => {
  return requestJson<{ message: string }>('/api/auth/send-verification-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      captcha_token: captchaToken ?? null,
    }),
  })
}

export const verifyEmail = async (token: string) => {
  const response = await requestJson<AuthResponseDto>('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  return toSession(response.user)
}

export const listSessions = async (): Promise<AuthSessionDevice[]> => {
  const response = await requestJson<UserSessionsDto>('/api/auth/sessions')
  return response.items.map((item) => ({
    id: item.id,
    userAgent: item.user_agent,
    ipAddress: item.ip_address,
    createdAt: item.created_at,
    expiresAt: item.expires_at,
    revokedAt: item.revoked_at,
    lastSeenAt: item.last_seen_at,
    current: item.current,
  }))
}

export const revokeOtherSessions = async (currentPassword: string) => {
  return requestJson<{ success: boolean }>('/api/auth/sessions/revoke-others', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: currentPassword,
    }),
  })
}
