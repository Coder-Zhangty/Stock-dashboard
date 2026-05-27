import { type ReactNode, useState, useEffect } from 'react'
import { Settings } from 'lucide-react'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function Layout({ children, onOpenSettings }: { children: ReactNode; onOpenSettings?: () => void }) {
  const time = useClock()

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-border-color flex items-center px-4 bg-bg-secondary shrink-0">
          <h1 className="text-sm font-semibold tracking-wide">智能量化投资辅助决策系统</h1>
          <div className="ml-auto flex items-center gap-2">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 rounded-full hover:bg-white/10 text-text-secondary hover:text-text-primary transition"
                title="设置"
              >
                <Settings size={17} />
              </button>
            )}
            <span className="text-sm text-text-primary font-mono tracking-wider">UTC+8 {time}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
