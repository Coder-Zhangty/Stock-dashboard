import { AuthPage } from '../../pages/AuthPage'
import type { AuthSecurityConfig } from '../../types/auth'

interface AuthPortalProps {
  error: string | null
  security: AuthSecurityConfig
  loginFailureCount: number
  onLogin: (input: {
    email: string
    password: string
    captchaToken?: string | null
  }) => Promise<void>
  onRegister: (input: {
    name: string
    email: string
    password: string
    confirmPassword: string
    captchaToken: string
  }) => Promise<void>
  onForgotPassword: (input: {
    email: string
    captchaToken: string
  }) => Promise<{ message: string }>
  onResetPassword: (input: {
    token: string
    password: string
    confirmPassword: string
  }) => Promise<void>
}

export const AuthPortal = (props: AuthPortalProps) => <AuthPage {...props} />
