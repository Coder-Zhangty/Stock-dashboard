import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <main className="flex min-h-screen items-center justify-center bg-bg-primary">
            <div className="rounded-lg border border-border-color bg-bg-secondary px-6 py-4 text-sm text-text-primary shadow-soft max-w-md text-center">
              <p className="font-medium text-text-primary">Something went wrong</p>
              <p className="mt-1 text-text-secondary">{this.state.error?.message ?? 'An unexpected error occurred.'}</p>
              <button
                className="mt-3 rounded bg-accent-blue px-4 py-1.5 text-sm text-white hover:opacity-90"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
              >
                Reload page
              </button>
            </div>
          </main>
        )
      )
    }

    return this.props.children
  }
}
