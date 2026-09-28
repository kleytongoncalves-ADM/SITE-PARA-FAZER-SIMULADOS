import { useMemo, useState } from 'react'
import { CalendarClock, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo, concurso } from '@/lib/data/edital'
import { statsPorDisciplina } from '@/lib/analytics'
import { cn, formatDate } from '@/lib/utils'
import type { StudyPlanDay } from '@/lib/types'

const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export function PlanoEstudos() {
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const plano = useAppStore((s) => s.plano)
  const definirPlano = useAppStore((s) => s.definirPlano)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const stats = useMemo(() => statsPorDisciplina(attempts, disciplinas), [attempts, disciplinas])

  const [horasPorDia, setHorasPorDia] = useState(onboarding.horasPorDia)
  const [diasPorSemana, setDiasPorSemana] = useState(5)

  function gerarPlano() {
    const prioridades = [...stats].sort((a, b) => a.percent - b.percent).map((s) => s.disciplina.id)
    const diasAtivos = diasSemana.slice(0, diasPorSemana)
    const minutosDia = horasPorDia * 60
    const cronograma: StudyPlanDay[] = diasAtivos.map((dia, i) => {
      const disc1 = disciplinas.find((d) => d.id === prioridades[i % prioridades.length]) ?? disciplinas[0]
      const disc2 = disciplinas.find((d) => d.id === prioridades[(i + 1) % prioridades.length]) ?? disciplinas[1]
      const blocoPrincipal = Math.round(minutosDia * 0.45)
      const blocoSecundario = Math.round(minutosDia * 0.35)
      const blocoRevisao = minutosDia - blocoPrincipal - blocoSecundario
      const horaInicio = 19
      const h2 = horaInicio + Math.floor(blocoPrincipal / 60)
      const m2 = blocoPrincipal % 60
      const h3 = h2 + Math.floor((m2 + blocoSecundario) / 60)
      const m3 = (m2 + blocoSecundario) % 60
      return {
        dia,
        blocos: [
          { horario: `${String(horaInicio).padStart(2, '0')}:00`, atividade: `${disc1.nome} (${blocoPrincipal} min, foco no ponto fraco)`, disciplinaId: disc1.id },
          { horario: `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`, atividade: `${disc2.nome} (${blocoSecundario} min)`, disciplinaId: disc2.id },
          { horario: `${String(h3).padStart(2, '0')}:${String(m3).padStart(2, '0')}`, atividade: `Revisão de erros (${blocoRevisao} min)` },
        ],
      }
    })

    definirPlano({ dataProva: onboarding.dataProva, horasPorDia, diasPorSemana, prioridades, cronograma })
  }

  return (
    <div>
      <PageHeader title="Meu plano de estudos" subtitle={`Prova em ${formatDate(concurso.dataProva)} — o plano se adapta ao seu desempenho real.`} />

      <div className="px-4 lg:px-6 grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader title="Configurar plano" />
          <CardBody className="flex flex-col gap-5">
            <div>
              <div className="text-sm font-medium mb-2">Horas disponíveis por dia</div>
              <input
                type="range"
                min={0.5}
                max={6}
                step={0.5}
                value={horasPorDia}
                onChange={(e) => setHorasPorDia(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="text-right text-sm font-semibold">{horasPorDia}h/dia</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Dias por semana</div>
              <div className="flex gap-2 flex-wrap">
                {[3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDiasPorSemana(n)}
                    className={cn('w-10 h-10 rounded-lg surface-2 font-semibold text-sm', diasPorSemana === n && 'bg-brand-600 text-white')}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Button icon={<Sparkles size={16} />} onClick={gerarPlano}>
              Gerar plano de estudos
            </Button>
          </CardBody>
        </Card>

        <div className="lg:col-span-2 flex flex-col gap-3">
          {!plano && (
            <Card className="p-8 flex flex-col items-center text-center gap-2">
              <CalendarClock size={32} className="text-muted" />
              <p className="text-muted text-sm">Configure suas preferências e gere seu cronograma semanal personalizado.</p>
            </Card>
          )}
          {plano?.cronograma.map((dia) => (
            <Card key={dia.dia}>
              <CardHeader title={dia.dia} />
              <CardBody className="flex flex-col gap-2">
                {dia.blocos.map((bloco, i) => {
                  const disc = disciplinas.find((d) => d.id === bloco.disciplinaId)
                  return (
                    <div key={i} className="flex items-center gap-3 surface-2 rounded-xl p-3">
                      <span className="font-mono text-sm font-semibold text-brand-500 w-14 shrink-0">{bloco.horario}</span>
                      {disc && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: disc.cor }} />}
                      <span className="text-sm">{bloco.atividade}</span>
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
