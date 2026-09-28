import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MasteryBar } from '@/components/ui/ProgressBar'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { statsPorAssunto } from '@/lib/analytics'
import { selecionarQuestoes } from '@/lib/simuladoBuilder'
import type { Simulado } from '@/lib/types'

export function Disciplina() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const getBanco = useAppStore((s) => s.getBanco)
  const criarSimulado = useAppStore((s) => s.criarSimulado)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const disciplina = disciplinas.find((d) => d.id === id)
  const assuntos = useMemo(() => statsPorAssunto(attempts, disciplinas).filter((a) => a.disciplina.id === id), [attempts, disciplinas, id])

  if (!disciplina) {
    return (
      <div className="p-6">
        <p className="text-muted">Disciplina não encontrada.</p>
      </div>
    )
  }

  function praticarAssunto(assuntoId: string) {
    const banco = getBanco()
    const questoes = selecionarQuestoes(banco, attempts, {
      modo: 'assunto',
      quantidade: 10,
      disciplinaIds: [disciplina!.id],
      assuntoIds: [assuntoId],
      dificuldade: 'todas',
      modoProva: false,
      tempoLimiteMinutos: 20,
    })
    const simulado: Simulado = {
      id: `sim-assunto-${Date.now()}`,
      titulo: `Praticar: ${disciplina!.assuntos.find((a) => a.id === assuntoId)?.nome}`,
      modo: 'assunto',
      modoProva: false,
      questoesIds: questoes.map((q) => q.id),
      tempoLimiteMinutos: 20,
      criadoEm: new Date().toISOString(),
      respostas: {},
      marcadas: [],
    }
    criarSimulado(simulado)
    navigate(`/simulado/${simulado.id}`)
  }

  return (
    <div>
      <div className="px-4 lg:px-6 pt-6">
        <button onClick={() => navigate('/disciplinas')} className="flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]">
          <ChevronLeft size={16} /> Disciplinas
        </button>
      </div>
      <PageHeader
        title={disciplina.nome}
        subtitle={`${disciplina.numQuestoesEdital} questões no edital · peso ${disciplina.peso} · ${disciplina.assuntos.length} assuntos`}
        action={
          <Button
            icon={<Play size={16} />}
            onClick={() => {
              const banco = getBanco()
              const questoes = selecionarQuestoes(banco, attempts, {
                modo: 'disciplina',
                quantidade: 15,
                disciplinaIds: [disciplina.id],
                assuntoIds: [],
                dificuldade: 'todas',
                modoProva: true,
                tempoLimiteMinutos: 30,
              })
              const simulado: Simulado = {
                id: `sim-disc-${Date.now()}`,
                titulo: `Simulado: ${disciplina.nome}`,
                modo: 'disciplina',
                modoProva: true,
                questoesIds: questoes.map((q) => q.id),
                tempoLimiteMinutos: 30,
                criadoEm: new Date().toISOString(),
                respostas: {},
                marcadas: [],
              }
              criarSimulado(simulado)
              navigate(`/simulado/${simulado.id}`)
            }}
          >
            Simulado desta disciplina
          </Button>
        }
      />

      <div className="px-4 lg:px-6 pb-10">
        <Card>
          <CardHeader title="Assuntos" subtitle="Nível de domínio calculado com base no seu histórico de respostas" />
          <CardBody className="flex flex-col gap-4">
            {assuntos.map((a) => (
              <div key={a.assuntoId} className="flex items-center gap-4 surface-2 rounded-xl p-4">
                <span className="text-xl shrink-0">{a.mastery.emoji}</span>
                <div className="flex-1">
                  <MasteryBar label={a.assuntoNome} percent={a.mastery.percent} color={disciplina.cor} right={a.mastery.label} />
                </div>
                <Button size="sm" variant="secondary" onClick={() => praticarAssunto(a.assuntoId)}>
                  Praticar
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
