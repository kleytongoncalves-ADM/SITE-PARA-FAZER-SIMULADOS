import type { Attempt } from './types'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export interface MasteryLevel {
  label: string
  emoji: string
  colorVar: string
  percent: number
}

export function computeMastery(attempts: Attempt[]): MasteryLevel {
  if (attempts.length === 0) {
    return { label: 'Sem dados', emoji: '⚪', colorVar: 'var(--text-muted)', percent: 0 }
  }
  const recent = attempts.slice(-10)
  const acertos = recent.filter((a) => a.correta).length
  const taxa = (acertos / recent.length) * 100
  const volumeBonus = Math.min(attempts.length / 20, 1) * 10
  const percent = Math.min(100, Math.round(taxa * 0.9 + volumeBonus))

  if (percent < 30) return { label: 'Crítico', emoji: '🔴', colorVar: 'var(--color-danger-500)', percent }
  if (percent < 55) return { label: 'Precisa melhorar', emoji: '🟠', colorVar: 'var(--color-warning-500)', percent }
  if (percent < 75) return { label: 'Em desenvolvimento', emoji: '🟡', colorVar: 'var(--color-warning-400)', percent }
  if (percent < 92) return { label: 'Dominado', emoji: '🟢', colorVar: 'var(--color-success-500)', percent }
  return { label: 'Excelente', emoji: '🔵', colorVar: 'var(--color-brand-500)', percent }
}

export function groupBy<T, K extends string | number>(arr: T[], keyFn: (item: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    ;(acc[key] ||= []).push(item)
    return acc
  }, {} as Record<K, T[]>)
}

export function xpForAttempt(attempt: Attempt) {
  if (!attempt.correta) return 2
  if (attempt.tempoSegundos < 30) return 14
  return 10
}

export function levelFromXp(xp: number) {
  const level = Math.floor(xp / 250) + 1
  const xpInLevel = xp % 250
  return { level, xpInLevel, xpToNext: 250 }
}

export function currentStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const daysSet = new Set(dates.map((d) => new Date(d).toDateString()))
  let streak = 0
  const cursor = new Date()
  for (;;) {
    if (daysSet.has(cursor.toDateString())) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
