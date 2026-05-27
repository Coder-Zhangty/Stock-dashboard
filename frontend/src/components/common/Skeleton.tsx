import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded bg-bg-card',
        className,
      )}
    />
  )
}

export function SkeletonText({ width = 'w-full', size = 'h-4' }: { width?: string; size?: string }) {
  return <Skeleton className={`${size} ${width}`} />
}

export function SkeletonTable({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <table className="w-full text-xs" style={{ minWidth: 650 }}>
      <thead className="sticky top-0 bg-bg-secondary border-b border-border-color z-10">
        <tr className="text-text-secondary">
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="py-2 px-3 font-medium">
              <Skeleton className="h-3 w-12 rounded" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <tr key={ri} className="border-b border-border-color/50">
            {Array.from({ length: cols }).map((_, ci) => (
              <td key={ci} className="py-2 px-3">
                <Skeleton className="h-3 w-full rounded" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function SkeletonCard({ height = 'h-48' }: { height?: string }) {
  return (
    <div className="card flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded" />
      <Skeleton className={`${height} w-full rounded`} />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
    </div>
  )
}

export function SkeletonQuote() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border-color">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
      <div className="flex flex-col gap-1.5 ml-auto">
        <Skeleton className="h-7 w-20 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
      </div>
    </div>
  )
}

export function SkeletonChart({ height = 500 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-48 rounded" />
      </div>
    </div>
  )
}

export function SkeletonNewsItem() {
  return (
    <div className="px-3 py-2 border-b border-border-color/50 space-y-1.5">
      <Skeleton className="h-3 w-full rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-2.5 w-16 rounded" />
        <Skeleton className="h-2.5 w-12 rounded" />
      </div>
    </div>
  )
}

export function SkeletonNewsList({ count = 8 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonNewsItem key={i} />
      ))}
    </div>
  )
}
