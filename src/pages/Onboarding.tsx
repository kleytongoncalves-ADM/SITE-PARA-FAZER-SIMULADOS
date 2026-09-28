import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { concurso } from '@/lib/data/edital'
import { useAppStore } from '@/lib/store'
import { cn, formatDate } from '@/lib/utils'

const passos = ['intro', 'concurso', 'cargo', 'data', 'tempo', 'pronto'] as const
type Passo = (typeof passos)[number]

export function Onboarding() {
  const [passo, setPasso] = useState<Passo>('intro')
  const [cargoId, setCargoId] = useState('101')
  const [horasPorDia, setHorasPorDia] = useState(2)
  const concluirOnboarding = useAppStore((s) => s.concluirOnboarding)
  const navigate = useNavigate()

  const idx = passos.indexOf(passo)

  function proximo() {
    const next = passos[idx + 1]
    if (next) setPasso(next)
  }

  function finalizar() {
    concluirOnboarding({ concursoId: concurso.id, cargoId, dataProva: concurso.dataProva, horasPorDia })
    navigate('/dashboard')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl">APROVA.AI</span>
        </div>

        <div className="flex gap-1.5 mb-8 justify-center">
          {passos.map((p, i) => (
            <div key={p} className={cn('h-1.5 w-10 rounded-full', i <= idx ? 'bg-brand-500' : 'surface-2')} />
          ))}
        </div>

        <div className="surface rounded-3xl p-8 shadow-[var(--shadow-soft)] min-h-[380px] flex flex-col">
          {passo === 'intro' && (
            <div className="flex-1 flex flex-col items-center text-center justify-center gap-4">
              <h1 className="font-display text-3xl font-bold tracking-tight">Vamos preparar você para a prova.</h1>
              <p className="text-muted max-w-sm">
                Você não precisa apenas saber se acertou. Precisa entender por que errou. Vamos montar sua trilha de
                preparação a partir do edital real do seu concurso.
              </p>
              <Button size="lg" onClick={proximo} icon={<ArrowRight size={18} />} className="mt-4">
                Começar
              </Button>
            </div>
          )}

          {passo === 'concurso' && (
            <div className="flex-1 flex flex-col">
              <h2 className="font-display text-xl font-bold mb-1">Selecione o concurso</h2>
              <p className="text-muted text-sm mb-6">Identificamos automaticamente o edital que você anexou.</p>
              <button className="surface-2 rounded-2xl p-5 text-left border-2 border-brand-500">
                <div className="font-semibold">{concurso.nome}</div>
                <div className="text-sm text-muted mt-1">{concurso.orgao}</div>
                <div className="flex gap-2 mt-3 flex-wrap text-xs">
                  <span className="surface rounded-full px-2.5 py-1">Banca: {concurso.banca}</span>
                  <span className="surface rounded-full px-2.5 py-1">Prova: {formatDate(concurso.dataProva)}</span>
                </div>
              </button>
              <Button size="lg" onClick={proximo} icon={<ArrowRight size={18} />} className="mt-auto self-end">
                Continuar
              </Button>
            </div>
          )}

          {passo === 'cargo' && (
            <div className="flex-1 flex flex-col">
              <h2 className="font-display text-xl font-bold mb-1">Selecione o cargo</h2>
              <p className="text-muted text-sm mb-6">Cada cargo tem um conteúdo específico definido no Anexo IV do edital.</p>
              <div className="flex flex-col gap-3">
                {concurso.cargos.map((cargo) => (
                  <button
                    key={cargo.id}
                    onClick={() => setCargoId(cargo.id)}
                    className={cn(
                      'surface-2 rounded-2xl p-4 text-left border-2 transition-colors',
                      cargoId === cargo.id ? 'border-brand-500' : 'border-transparent hover:border-[var(--border)]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{cargo.nome}</span>
                      {cargoId === cargo.id && <CheckCircle2 size={18} className="text-brand-500" />}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      Nível {cargo.nivel === 'superior' ? 'Superior' : 'Médio'} · {cargo.vagasImediatas + cargo.vagasCadastroReserva} vagas
                      totais
                    </div>
                  </button>
                ))}
              </div>
              <Button size="lg" onClick={proximo} icon={<ArrowRight size={18} />} className="mt-6 self-end">
                Continuar
              </Button>
            </div>
          )}

          {passo === 'data' && (
            <div className="flex-1 flex flex-col">
              <h2 className="font-display text-xl font-bold mb-1">Data da prova</h2>
              <p className="text-muted text-sm mb-6">Definida no cronograma oficial do Anexo VII do edital.</p>
              <div className="surface-2 rounded-2xl p-6 text-center">
                <div className="text-4xl font-display font-bold text-brand-500">{formatDate(concurso.dataProva)}</div>
                <div className="text-sm text-muted mt-2">Prova objetiva e discursiva/redação, turno da tarde</div>
              </div>
              <Button size="lg" onClick={proximo} icon={<ArrowRight size={18} />} className="mt-auto self-end">
                Continuar
              </Button>
            </div>
          )}

          {passo === 'tempo' && (
            <div className="flex-1 flex flex-col">
              <h2 className="font-display text-xl font-bold mb-1">Quanto tempo você tem por dia?</h2>
              <p className="text-muted text-sm mb-6">Vamos usar isso para montar seu plano de estudos.</p>
              <div className="flex items-center gap-4 justify-center py-6">
                <button
                  className="w-11 h-11 rounded-full surface-2 text-xl font-bold"
                  onClick={() => setHorasPorDia((h) => Math.max(0.5, h - 0.5))}
                >
                  −
                </button>
                <div className="font-display text-4xl font-bold w-28 text-center tabular-nums">{horasPorDia}h</div>
                <button
                  className="w-11 h-11 rounded-full surface-2 text-xl font-bold"
                  onClick={() => setHorasPorDia((h) => Math.min(8, h + 0.5))}
                >
                  +
                </button>
              </div>
              <Button size="lg" onClick={proximo} icon={<ArrowRight size={18} />} className="mt-auto self-end">
                Continuar
              </Button>
            </div>
          )}

          {passo === 'pronto' && (
            <div className="flex-1 flex flex-col items-center text-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-success-500" />
              </div>
              <h2 className="font-display text-2xl font-bold">Pronto.</h2>
              <p className="text-muted max-w-sm">
                Seu plano de preparação para {concurso.cargos.find((c) => c.id === cargoId)?.nome} foi criado com base no
                edital do {concurso.orgao}.
              </p>
              <Button size="lg" onClick={finalizar} icon={<ArrowRight size={18} />} className="mt-2">
                Ir para o meu dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
