import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchBatchQuotes } from '../services/api'

interface QuoteData {
  latest_price: number
  prev_close: number
  change_pct: number
  change_amount: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  turnover: number
}

type QuoteMap = Record<string, QuoteData>

interface UseRealtimeQuotesOptions {
  pollInterval?: number
}

export function useRealtimeQuotes(
  codes: string[],
  options: UseRealtimeQuotesOptions = {},
) {
  const { pollInterval = 3000 } = options
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const subscribedRef = useRef<Set<string>>(new Set())
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHttp = useCallback(async (c: string[]) => {
    if (!c.length) return
    try {
      const data = await fetchBatchQuotes(c)
      setQuotes((prev) => ({ ...prev, ...data }))
    } catch {
      // HTTP fallback failed, silently ignore
    }
  }, [])

  // WebSocket connection
  useEffect(() => {
    if (!codes.length) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/api/ws/quotes`

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      try {
        ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          setConnected(true)
          // Subscribe to current codes
          if (codes.length > 0) {
            ws!.send(JSON.stringify({ type: 'subscribe', codes }))
            subscribedRef.current = new Set(codes)
          }
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'quote_update' && msg.code && msg.quote) {
              setQuotes((prev) => ({ ...prev, [msg.code]: msg.quote }))
            }
          } catch {
            // ignore parse errors
          }
        }

        ws.onclose = () => {
          setConnected(false)
          wsRef.current = null
          // Reconnect after 3s
          reconnectTimer = setTimeout(connect, 3000)
        }

        ws.onerror = () => {
          ws?.close()
        }
      } catch {
        // WebSocket not supported, fall back to polling
        wsRef.current = null
      }
    }

    connect()

    // HTTP polling fallback (always runs as supplement, plus handles ws failure)
    pollTimerRef.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchHttp(codes)
      }
    }, pollInterval)

    return () => {
      clearTimeout(reconnectTimer)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      wsRef.current = null
    }
  }, [codes.join(','), fetchHttp, pollInterval])

  const subscribe = useCallback((newCodes: string[]) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      const toAdd = newCodes.filter((c) => !subscribedRef.current.has(c))
      if (toAdd.length > 0) {
        ws.send(JSON.stringify({ type: 'subscribe', codes: toAdd }))
        toAdd.forEach((c) => subscribedRef.current.add(c))
      }
    }
  }, [])

  const unsubscribe = useCallback((oldCodes: string[]) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe', codes: oldCodes }))
      oldCodes.forEach((c) => subscribedRef.current.delete(c))
    }
  }, [])

  return { quotes, connected, subscribe, unsubscribe, fetchHttp }
}
