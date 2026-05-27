import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

interface ToastContextType {
  toast: (message: string, type?: ToastItem['type']) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastItem['type'] = 'error') => {
    const id = nextId++
    setToasts((prev) => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const colors: Record<string, string> = {
    error: 'border-red-500/40 bg-red-900/20 text-red-300',
    success: 'border-green-500/40 bg-green-900/20 text-green-300',
    info: 'border-blue-500/40 bg-blue-900/20 text-blue-300',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-2.5 rounded-lg border text-xs animate-slide-up ${colors[t.type]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
