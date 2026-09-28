import { Flag, Star } from 'lucide-react'
import { Card, CardBody } from './ui/Card'
import { Badge } from './ui/Badge'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Question } from '@/lib/types'

export function QuestionCard({
  question,
  numero,
  total,
  respostaSelecionada,
  onSelecionar,
  mostrarGabarito,
  marcada,
  onToggleMarcar,
}: {
  question: Question
  numero: number
  total: number
  respostaSelecionada?: string
  onSelecionar?: (letra: string) => void
  mostrarGabarito?: boolean
  marcada?: boolean
  onToggleMarcar?: () => void
}) {
  const favoritos = useAppStore((s) => s.favoritos)
  const toggleFavorito = useAppStore((s) => s.toggleFavorito)
  const isFavorito = favoritos.includes(question.id)

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="brand">
              Questão {numero}/{total}
            </Badge>
            <Badge tone="neutral">{question.dificuldade === 'facil' ? 'Fácil' : question.dificuldade === 'media' ? 'Média' : 'Difícil'}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {onToggleMarcar && (
              <button
                onClick={onToggleMarcar}
                className={cn('p-2 rounded-lg', marcada ? 'text-warning-500 bg-warning-500/10' : 'text-muted hover:bg-[var(--surface-2)]')}
                aria-label="Marcar questão"
                title="Marcar para revisar depois"
              >
                <Flag size={16} />
              </button>
            )}
            <button
              onClick={() => toggleFavorito(question.id)}
              className={cn('p-2 rounded-lg', isFavorito ? 'text-warning-500 bg-warning-500/10' : 'text-muted hover:bg-[var(--surface-2)]')}
              aria-label="Favoritar questão"
              title="Favoritar"
            >
              <Star size={16} fill={isFavorito ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <p className="text-[15px] leading-relaxed mb-5">{question.enunciado}</p>

        <div className="flex flex-col gap-2.5">
          {question.alternativas.map((alt) => {
            const selecionada = respostaSelecionada === alt.letra
            const correta = mostrarGabarito && alt.letra === question.respostaCorreta
            const errada = mostrarGabarito && selecionada && alt.letra !== question.respostaCorreta
            return (
              <button
                key={alt.letra}
                onClick={() => onSelecionar?.(alt.letra)}
                disabled={mostrarGabarito}
                className={cn(
                  'text-left rounded-xl p-3.5 border-2 flex gap-3 items-start transition-colors surface-2',
                  !mostrarGabarito && selecionada && 'border-brand-500',
                  !mostrarGabarito && !selecionada && 'border-transparent hover:border-[var(--border)]',
                  correta && 'border-success-500 bg-success-500/10',
                  errada && 'border-danger-500 bg-danger-500/10',
                )}
              >
                <span
                  className={cn(
                    'w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2',
                    selecionada && !mostrarGabarito && 'bg-brand-500 border-brand-500 text-white',
                    correta && 'bg-success-500 border-success-500 text-white',
                    errada && 'bg-danger-500 border-danger-500 text-white',
                    !selecionada && !correta && !errada && 'border-[var(--border)] text-muted',
                  )}
                >
                  {alt.letra}
                </span>
                <span className="text-sm leading-relaxed pt-0.5">{alt.texto}</span>
              </button>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
