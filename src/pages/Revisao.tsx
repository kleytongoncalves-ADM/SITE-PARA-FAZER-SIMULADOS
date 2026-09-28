import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCcw, Timer, Play } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MasteryBar } from '@/components/ui/ProgressBar'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { statsPorAssunto } from '@/lib/analytics'
import { selecionarQuestoes } from '@/lib/simuladoBuilder'
import { cn } from '@/lib/utils'
import type { Simulado } from '@/lib/types'

const duracoes = [
  { minutos: 15, label: '15 minutos', questoes: 6 },
  { minutos: 30, label: '30 minutos', questoes: 12 },
  { minutos: 60, label: '60 minutos', questoes: 24 },
  { minutos: 90, label: '90 minutos', questoes: 36 },
  { minutos: 120, label: '2 horas', questoes: 48 },
]

export function Revisao() {
  const navigate = useNavigate()
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const getBanco = useAppStore((s) => s.getBanco)
  const criarSimulado = useAppStore((s) => s.criarSimulado)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])

  const [duracaoSelecionada, setDuracaoSelecionada] = useState(30)

  const assuntosPrioritarios = useMemo(
    () =>
      statsPorAssunto(attempts, disciplinas)
        .filter((r) => r.total >= 2)
        .sort((a, b) => a.percent - b.percent)
        .slice(0, 5),
    [attempts, disciplinas],
  )

  function iniciarRevisao(minutos: number) {
    const duracao = duracoes.find((d) => d.minutos === minutos)!
    const banco = getBanco()
    const questoes = selecionarQuestoes(banco, attempts, {
      modo: 'revisao',
      quantidade: duracao.questoes,
      disciplinaIds: [],
      assuntoIds: [],
      dificuldade: 'todas',
      modoProva: false,
      tempoLimiteMinutos: minutos,
    })
    const simulado: Simulado = {
      id: `sim-rev-${Date.now()}`,
      titulo: `Revisão inteligente · ${duracao.label}`,
      modo: 'revisao',
      modoProva: false,
      questoesIds: questoes.map((q) => q.id),
      tempoLimiteMinutos: minutos,
      criadoEm: new Date().toISOString(),
      respostas: {},
      marcadas: [],
    }
    criarSimulado(simulado)
    navigate(`/simulado/${simulado.id}`)
  }

  return (
    <div>
      <PageHeader title="Revisão de hoje" subtitle="Selecionamos automaticamente os assuntos que mais precisam da sua atenção." />

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><RefreshCcw size={16} /> Hoje você deveria revisar</span>} />
          <CardBody className="flex flex-col gap-4">
            {assuntosPrioritarios.length === 0 && <p className="text-sm text-muted">Resolva mais questões para gerarmos recomendações.</p>}
            {assuntosPrioritarios.map((a, i) => (
              <div key={a.assuntoId} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full surface-2 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <MasteryBar label={a.assuntoNome} percent={a.percent} color={a.disciplina.cor} />
                </div>
              </div>
            ))}
            <Button icon={<Play size={16} />} onClick={() => iniciarRevisao(duracaoSelecionada)} className="self-start mt-2">
              Começar revisão
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Timer size={16} /> Quanto tempo você tem agora?</span>} />
          <CardBody className="flex flex-col gap-3">
            {duracoes.map((d) => (
              <button
                key={d.minutos}
                onClick={() => setDuracaoSelecionada(d.minutos)}
                className={cn(
                  'flex items-center justify-between surface-2 rounded-xl p-3.5 border-2',
                  duracaoSelecionada === d.minutos ? 'border-brand-500' : 'border-transparent',
                )}
              >
                <span className="font-medium text-sm">Eu tenho {d.label}</span>
                <span className="text-xs text-muted">{d.questoes} questões</span>
              </button>
            ))}
            <Button variant="secondary" icon={<Play size={16} />} onClick={() => iniciarRevisao(duracaoSelecionada)}>
              Iniciar sessão de {duracoes.find((d) => d.minutos === duracaoSelecionada)?.label}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
