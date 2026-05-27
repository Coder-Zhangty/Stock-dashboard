import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'

interface Props {
  items: any[]
  itemHeight: number
  overscan?: number
  className?: string
  children: (item: any, index: number) => ReactNode
  onEndReached?: () => void
  endThreshold?: number
}

export function VirtualList({
  items,
  itemHeight,
  overscan = 5,
  className,
  children,
  onEndReached,
  endThreshold = 5,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop)
      if (!onEndReached || !items.length) return
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      const remaining = scrollHeight - scrollTop - clientHeight
      if (remaining < itemHeight * endThreshold) {
        onEndReached()
      }
    },
    [onEndReached, items.length, itemHeight, endThreshold],
  )

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  )
  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      style={{ overflow: 'auto' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {children(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
