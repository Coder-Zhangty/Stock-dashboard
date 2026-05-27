import { useEffect, useState } from 'react'

import {
  changePassword,
  fetchSession,
  forgotPassword,
  login,
  listSessions,
  logout,
  register,
  revokeOtherSessions,
  resetPassword,
  sendVerificationEmail,
} from '../services/auth'
import type { AuthSecurityConfig, AuthSession } from '../types/auth'

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [security, setSecurity] = useState<AuthSecurityConfig>({
    provider: 'mock',
    siteKey: null,
    mockTokenHint: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loginFailureCount, setLoginFailureCount] = useState(0)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const next = await fetchSession()
        setSession(next.user)
        setSecurity(next.security)
      } catch {
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [])

  const handleLogin = async (input: {
    email: string
    password: string
    captchaToken?: string | null
  }) => {
    try {
      const next = await login(input)
      setSession(next)
      setError(null)
      setLoginFailureCount(0)
    } catch (loginError) {
      setLoginFailureCount((count) => count + 1)
      throw loginError
    }
  }

  const handleRegister = async (input: {
    name: string
    email: string
    password: string
    confirmPassword: string
    captchaToken: string
  }) => {
    const next = await register(input)
    setSession(next)
    setError(null)
  }

  const handleLogout = async () => {
    await logout()
    setSession(null)
    setError(null)
  }

  const handleForgotPassword = async (input: { email: string; captchaToken: string }) => {
    return forgotPassword(input)
  }

  const handleSendVerificationEmail = async (captchaToken?: string | null) => {
    return sendVerificationEmail(captchaToken)
  }

  const handleListSessions = async () => {
    return listSessions()
  }

  const handleRevokeOtherSessions = async (currentPassword: string) => {
    return revokeOtherSessions(currentPassword)
  }

  const handleChangePassword = async (input: {
    currentPassword: string
    newPassword: string
    revokeOtherSessions?: boolean
  }) => {
    const next = await changePassword(input)
    setSession(next)
    setError(null)
    return next
  }

  const handleResetPassword = async (input: {
    token: string
    password: string
    confirmPassword: string
  }) => {
    await resetPassword(input)
    setError(null)
  }

  return {
    session,
    security,
    isLoading,
    error,
    setError,
    loginFailureCount,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    forgotPassword: handleForgotPassword,
    sendVerificationEmail: handleSendVerificationEmail,
    listSessions: handleListSessions,
    revokeOtherSessions: handleRevokeOtherSessions,
    changePassword: handleChangePassword,
    resetPassword: handleResetPassword,
  }
}
