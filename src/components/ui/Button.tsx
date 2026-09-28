import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  fullWidth?: boolean
}

const variants: Record<string, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 shadow-[var(--shadow-glow)] disabled:opacity-50 disabled:shadow-none',
  secondary: 'surface hover:bg-[var(--surface-2)] text-[var(--text)]',
  ghost: 'hover:bg-[var(--surface-2)] text-[var(--text)]',
  danger: 'bg-danger-500 text-white hover:bg-danger-500/90',
  success: 'bg-success-500 text-white hover:bg-success-500/90',
}

const sizes: Record<string, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-xl',
  lg: 'text-base px-6 py-3.5 gap-2 rounded-2xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
