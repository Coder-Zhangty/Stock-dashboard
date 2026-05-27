import { AdminPage } from '../../pages/AdminPage'
import type { AuthSession } from '../../types/auth'

interface AdminAppProps {
  session: AuthSession
  onLogout: () => Promise<void>
  onOpenChat?: () => void
}

export const AdminApp = ({ session, onLogout, onOpenChat }: AdminAppProps) => (
  <>
    {onOpenChat ? (
      <button
        type="button"
        onClick={onOpenChat}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-[0_18px_38px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5"
      >
        返回聊天
      </button>
    ) : null}
    <AdminPage session={session} onLogout={() => void onLogout()} />
  </>
)
