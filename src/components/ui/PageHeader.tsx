import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 lg:px-6 pt-6 pb-4">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
