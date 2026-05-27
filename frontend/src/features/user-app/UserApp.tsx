import { ChatPage } from '../../pages/ChatPage'
import type { AuthSession } from '../../types/auth'

interface UserAppProps {
  session: AuthSession
  onLogout: () => Promise<void>
  onOpenAdmin?: () => void
}

export const UserApp = ({ session, onLogout, onOpenAdmin }: UserAppProps) => (
  <ChatPage session={session} onLogout={() => void onLogout()} onOpenAdmin={onOpenAdmin} />
)
