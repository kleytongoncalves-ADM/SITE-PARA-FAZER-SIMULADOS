import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { errosRecorrentes } from '@/lib/analytics'
import { cn, formatDate, groupBy } from '@/lib/utils'

type Filtro = 'todos' | 'hoje' | 'semana' | 'recorrentes' | 'revisar' | 'aprendidos'

const filtros: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Errei hoje' },
  { id: 'semana', label: 'Errei esta semana' },
  { id: 'recorrentes', label: 'Errei várias vezes' },
  { id: 'revisar', label: 'Preciso revisar' },
  { id: 'aprendidos', label: 'Já aprendi' },
]

export function Erros() {
  const navigate = useNavigate()
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const getBanco = useAppStore((s) => s.getBanco)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const banco = getBanco()
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const errosOrdenados = useMemo(
    () => [...attempts].filter((a) => !a.correta).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [attempts],
  )

  const recorrentes = useMemo(() => errosRecorrentes(attempts, disciplinas), [attempts, disciplinas])
  const assuntosRecorrentesIds = new Set(recorrentes.map((r) => r.assuntoId))

  const hoje = new Date().toDateString()
  const seteDiasAtras = Date.now() - 7 * 86400000

  const filtrados = errosOrdenados.filter((a) => {
    if (filtro === 'hoje') return new Date(a.data).toDateString() === hoje
    if (filtro === 'semana') return new Date(a.data).getTime() >= seteDiasAtras
    if (filtro === 'recorrentes') return assuntosRecorrentesIds.has(a.assuntoId)
    if (filtro === 'revisar') return !a.revisado
    if (filtro === 'aprendidos') return !!a.revisado
    return true
  })

  const porDisciplina = groupBy(filtrados, (a) => a.disciplinaId)

  return (
    <div>
      <PageHeader title="Meus erros" subtitle="Organize, revise e transforme cada erro em aprendizado consolidado." />

      {recorrentes.length > 0 && (
        <div className="px-4 lg:px-6 mb-4">
          <Card className="border-2 border-warning-500/40 bg-warning-500/5">
            <CardBody className="pt-5 flex items-start gap-3">
              <AlertTriangle className="text-warning-500 shrink-0" size={22} />
              <div>
                <div className="font-semibold">Detectamos uma dificuldade recorrente.</div>
                <div className="text-sm text-muted mt-1">
                  Você errou {recorrentes[0].quantidade} questões relacionadas a <strong>{recorrentes[0].nome}</strong>.
                </div>
                <button
                  onClick={() => setFiltro('recorrentes')}
                  className="mt-3 text-sm font-semibold text-brand-500 flex items-center gap-1"
                >
                  Revisar agora <ChevronRight size={14} />
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="px-4 lg:px-6 flex flex-wrap gap-2 mb-4">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={cn('px-3.5 py-1.5 rounded-full text-sm font-medium surface-2', filtro === f.id && 'bg-brand-600 text-white')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-4 lg:px-6 flex flex-col gap-4 pb-10">
        {Object.entries(porDisciplina).length === 0 && (
          <Card>
            <CardBody className="pt-5 text-sm text-muted">Nenhum erro encontrado para este filtro. 🎉</CardBody>
          </Card>
        )}
        {Object.entries(porDisciplina).map(([discId, lista]) => {
          const disciplina = disciplinas.find((d) => d.id === discId)
          return (
            <Card key={discId}>
              <CardHeader
                title={disciplina?.nome ?? discId}
                subtitle={`${lista.length} erro(s)`}
                action={<span className="w-3 h-3 rounded-full" style={{ backgroundColor: disciplina?.cor }} />}
              />
              <CardBody className="flex flex-col gap-2">
                {lista.slice(0, 8).map((a) => {
                  const question = banco.find((q) => q.id === a.questionId)
                  const assunto = disciplina?.assuntos.find((x) => x.id === a.assuntoId)
                  return (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/questao/${a.questionId}?attempt=${a.id}`)}
                      className="flex items-center justify-between surface-2 rounded-xl p-3 text-left hover:bg-[var(--border)]/30"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium line-clamp-1">{question?.enunciado ?? assunto?.nome}</div>
                        <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                          <span>{assunto?.nome}</span>
                          <span>·</span>
                          <span>{formatDate(a.data)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {a.revisado ? <Badge tone="success">Já revisado</Badge> : <Badge tone="danger">Precisa revisar</Badge>}
                        <ChevronRight size={16} className="text-muted" />
                      </div>
                    </button>
                  )
                })}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
