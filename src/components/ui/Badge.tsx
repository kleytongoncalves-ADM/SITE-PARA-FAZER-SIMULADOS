import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones: Record<string, string> = {
  brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-300',
  success: 'bg-success-500/10 text-success-500',
  danger: 'bg-danger-500/10 text-danger-500',
  warning: 'bg-warning-500/10 text-warning-500',
  neutral: 'bg-[var(--surface-2)] text-muted border border-[var(--border)]',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}
