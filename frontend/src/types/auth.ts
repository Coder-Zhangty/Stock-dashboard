export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled' | 'suspended' | 'blocked' | 'pending'
  createdAt: string
  password?: string
}

export interface AuthSecurityConfig {
  provider: string
  siteKey?: string | null
  mockTokenHint?: string | null
}

export interface AuthStatus {
  authenticated: boolean
  user: AuthSession | null
  security: AuthSecurityConfig
}

export interface AuthSessionDevice {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  lastSeenAt: string | null
  current: boolean
}

export interface AuthSession {
  userId: string
  name: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled' | 'suspended' | 'blocked' | 'pending'
  createdAt: string
  accountType?: 'admin' | 'user'
  passwordResetRequired?: boolean
  emailVerifiedAt?: string | null
  mfaEnabled?: boolean
}
