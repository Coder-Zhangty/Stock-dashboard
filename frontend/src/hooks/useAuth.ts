import { useEffect, useState } from 'react'
import { fetchSession, login, logout, register } from '../services/auth'
import type { AuthSession } from '../types/auth'

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const next = await fetchSession()
        setSession(next.user)
      } catch {
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }
    void bootstrap()
  }, [])

  const handleLogin = async (input: { email: string; password: string }) => {
    const next = await login(input)
    setSession(next)
    setError(null)
  }

  const handleRegister = async (input: {
    name: string
    email: string
    password: string
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

  return {
    session,
    isLoading,
    error,
    setError,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  }
}
