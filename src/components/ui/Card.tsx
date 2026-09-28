import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('surface rounded-2xl shadow-[var(--shadow-soft)]', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-5 pb-3', className)}>
      <div>
        <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 pb-5', className)} {...props}>
      {children}
    </div>
  )
}
