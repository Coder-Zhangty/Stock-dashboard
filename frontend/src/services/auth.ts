import type { AuthSession } from '../types/auth'
import { requestJson } from './api'

interface SessionUserDto {
  id: string
  name: string
  email: string
  role: string
}

interface AuthResponseDto {
  user: SessionUserDto
}

interface AuthStatusDto {
  authenticated: boolean
  user: SessionUserDto | null
}

const toSession = (user: SessionUserDto): AuthSession => ({
  userId: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: 'active',
  createdAt: '',
  accountType: user.role,
  passwordResetRequired: false,
  emailVerifiedAt: null,
  mfaEnabled: false,
})

export const readStoredToken = () => null

export const readStoredSession = (): AuthSession | null => null

export const login = async (input: { email: string; password: string }) => {
  const response = await requestJson<AuthResponseDto>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, password: input.password }),
  })
  return toSession(response.user)
}

export const register = async (input: {
  name: string
  email: string
  password: string
}) => {
  const response = await requestJson<AuthResponseDto>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
    }),
  })
  return toSession(response.user)
}

export const fetchSession = async () => {
  const response = await requestJson<AuthStatusDto>('/api/auth/session')
  return {
    authenticated: response.authenticated,
    user: response.user ? toSession(response.user) : null,
    security: { provider: 'none', siteKey: null, mockTokenHint: null },
  }
}

export const logout = async () => {
  await requestJson('/api/auth/logout', { method: 'POST' })
}
