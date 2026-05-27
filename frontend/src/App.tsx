import { useState, lazy, Suspense } from 'react'
import Layout from './components/Layout'
import Dashboard from './features/dashboard/Dashboard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAuth } from './hooks/useAuth'
import { ChatProvider, useChatContext } from './contexts/ChatContext'
import type { MarketContext } from './types'
import { SkeletonChart } from './components/common/Skeleton'

const StockDetail = lazy(() => import('./features/dashboard/StockDetail'))
const FloatingChatOverlay = lazy(() => import('./features/chat/FloatingChatOverlay'))
const SettingsDrawer = lazy(() => import('./components/settings/SettingsDrawer'))

function StockDetailFallback() {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center gap-3 p-3 border-b border-border-color bg-bg-secondary">
        <div className="h-5 w-5 rounded bg-bg-card animate-pulse" />
        <div className="h-4 w-24 rounded bg-bg-card animate-pulse" />
      </div>
      <SkeletonChart height={500} />
    </div>
  )
}

function AppInner() {
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { session, isLoading: authLoading, logout } = useAuth()
  const { setMarketContext, setOverlayOpen } = useChatContext()

  const handleOpenChatForStock = (ctx: MarketContext) => {
    setMarketContext({ type: 'stock', label: `${ctx.name} (${ctx.code})`, data: ctx })
    setOverlayOpen(true)
  }

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <>
      <Layout onOpenSettings={() => setSettingsOpen(true)}>
        {selectedStock ? (
          <Suspense fallback={<StockDetailFallback />}>
            <StockDetail
              code={selectedStock}
              onBack={() => setSelectedStock(null)}
              onChatWithAI={handleOpenChatForStock}
            />
          </Suspense>
        ) : (
          <Dashboard
            onSelectStock={setSelectedStock}
            onLogout={handleLogout}
          />
        )}
      </Layout>
      <Suspense fallback={null}>
        <FloatingChatOverlay />
      </Suspense>
      <Suspense fallback={null}>
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </Suspense>
    </>
  )
}

function App() {
  const { session } = useAuth()

  return (
    <ErrorBoundary>
      <ChatProvider session={session}>
        <AppInner />
      </ChatProvider>
    </ErrorBoundary>
  )
}

export default App
