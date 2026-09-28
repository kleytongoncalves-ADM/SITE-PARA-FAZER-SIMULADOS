import type { ReactNode } from 'react'
import { Card } from './Card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'success' | 'danger' | 'warning' | 'accent'
}) {
  const toneClasses: Record<string, string> = {
    brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-300',
    success: 'bg-success-500/10 text-success-500',
    danger: 'bg-danger-500/10 text-danger-500',
    warning: 'bg-warning-500/10 text-warning-500',
    accent: 'bg-accent-500/10 text-accent-500',
  }
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted text-sm font-medium">{label}</span>
        {icon && <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', toneClasses[tone])}>{icon}</div>}
      </div>
      <div className="font-display text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </Card>
  )
}
