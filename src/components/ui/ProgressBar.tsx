import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  color = 'var(--color-brand-500)',
  height = 8,
  className,
  trackClassName,
}: {
  value: number
  color?: string
  height?: number
  className?: string
  trackClassName?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('w-full rounded-full overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]', trackClassName)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500 ease-out', className)}
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function MasteryBar({ label, percent, color, right }: { label: string; percent: number; color: string; right?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums">{right ?? `${Math.round(percent)}%`}</span>
      </div>
      <ProgressBar value={percent} color={color} />
    </div>
  )
}
