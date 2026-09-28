import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { MasteryBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { statsPorDisciplina } from '@/lib/analytics'

export function Disciplinas() {
  const [searchParams] = useSearchParams()
  const busca = searchParams.get('busca')?.toLowerCase() ?? ''
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const stats = useMemo(() => statsPorDisciplina(attempts, disciplinas), [attempts, disciplinas])

  const filtradas = busca
    ? stats.filter(
        (s) =>
          s.disciplina.nome.toLowerCase().includes(busca) ||
          s.disciplina.assuntos.some((a) => a.nome.toLowerCase().includes(busca)),
      )
    : stats

  return (
    <div>
      <PageHeader
        title="Disciplinas"
        subtitle={busca ? `Resultados para "${busca}"` : 'Estrutura extraída diretamente do Anexo III/IV do edital.'}
      />
      <div className="px-4 lg:px-6 grid sm:grid-cols-2 gap-4 pb-10">
        {filtradas.map((s) => (
          <Link key={s.disciplina.id} to={`/disciplina/${s.disciplina.id}`}>
            <Card className="p-5 h-full hover:shadow-[var(--shadow-glow)] transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.disciplina.cor }} />
                  <h3 className="font-display font-semibold">{s.disciplina.nome}</h3>
                </div>
                <ChevronRight size={18} className="text-muted shrink-0" />
              </div>
              <MasteryBar label="Domínio" percent={s.mastery.percent} color={s.disciplina.cor} />
              <div className="flex items-center justify-between mt-3">
                <Badge tone="neutral">{s.disciplina.assuntos.length} assuntos</Badge>
                <span className="text-xs text-muted">
                  {s.acertos}/{s.total} questões corretas
                </span>
              </div>
            </Card>
          </Link>
        ))}
        {filtradas.length === 0 && (
          <Card className="p-6 sm:col-span-2">
            <CardBody>Nenhum resultado encontrado.</CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
