import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, ArrowRight, Eye } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MasteryBar } from '@/components/ui/ProgressBar'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { groupBy } from '@/lib/utils'

export function Resultado() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const simulados = useAppStore((s) => s.simulados)
  const getBanco = useAppStore((s) => s.getBanco)
  const onboarding = useAppStore((s) => s.onboarding)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])

  const simulado = simulados.find((s) => s.id === id)
  const banco = getBanco()
  const questoes = useMemo(() => (simulado ? simulado.questoesIds.map((qid) => banco.find((q) => q.id === qid)!) : []), [simulado, banco])

  if (!simulado) {
    return (
      <div className="p-6">
        <p className="text-muted">Resultado não encontrado.</p>
      </div>
    )
  }

  const respondidas = questoes.filter((q) => simulado.respostas[q.id])
  const acertos = respondidas.filter((q) => simulado.respostas[q.id] === q.respostaCorreta).length
  const percent = questoes.length > 0 ? Math.round((acertos / questoes.length) * 100) : 0

  const porDisciplina = Object.entries(groupBy(questoes, (q) => q.disciplinaId)).map(([discId, lista]) => {
    const disciplina = disciplinas.find((d) => d.id === discId)!
    const ac = lista.filter((q) => simulado.respostas[q.id] === q.respostaCorreta).length
    return { disciplina, total: lista.length, acertos: ac, percent: lista.length ? Math.round((ac / lista.length) * 100) : 0 }
  })

  const erradas = questoes.filter((q) => simulado.respostas[q.id] && simulado.respostas[q.id] !== q.respostaCorreta)
  const errosPorAssunto = Object.entries(groupBy(erradas, (q) => q.assuntoId))
    .map(([assuntoId, lista]) => {
      let nome = assuntoId
      for (const d of disciplinas) {
        const a = d.assuntos.find((x) => x.id === assuntoId)
        if (a) nome = a.nome
      }
      return { assuntoId, nome, quantidade: lista.length }
    })
    .sort((a, b) => b.quantidade - a.quantidade)

  const piorDisciplina = [...porDisciplina].sort((a, b) => a.percent - b.percent)[0]

  return (
    <div>
      <PageHeader title="Simulado concluído" subtitle={simulado.titulo} />

      <div className="px-4 lg:px-6 grid lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-1 flex flex-col items-center justify-center text-center bg-gradient-to-br from-brand-600 to-brand-800 text-white border-none">
          <div className="font-display text-5xl font-bold">{percent}%</div>
          <div className="text-white/80 text-sm mt-1">de aproveitamento</div>
          <div className="flex gap-4 mt-4 text-sm">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={16} /> {acertos} acertos
            </span>
            <span className="flex items-center gap-1">
              <XCircle size={16} /> {respondidas.length - acertos} erros
            </span>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Seu desempenho" subtitle="Percentual de acerto por disciplina" />
          <CardBody className="flex flex-col gap-3">
            {porDisciplina.map((p) => (
              <MasteryBar key={p.disciplina.id} label={p.disciplina.nome} percent={p.percent} color={p.disciplina.cor} right={`${p.acertos}/${p.total}`} />
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-4 mt-6 pb-8">
        <Card>
          <CardHeader title="Onde você perdeu pontos" />
          <CardBody className="flex flex-col gap-2">
            {errosPorAssunto.length === 0 && <p className="text-sm text-muted">Nenhum erro registrado — excelente!</p>}
            {errosPorAssunto.map((e) => (
              <div key={e.assuntoId} className="flex items-center justify-between surface-2 rounded-xl p-3">
                <span className="text-sm font-medium">{e.nome}</span>
                <Badge tone="danger">{e.quantidade} erro(s)</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Recomendação" />
          <CardBody className="flex-1 flex flex-col gap-4">
            <p className="text-sm text-muted">
              {piorDisciplina
                ? `Antes de fazer outro simulado, recomendamos revisar ${piorDisciplina.disciplina.nome}${
                    errosPorAssunto[0] ? ` → ${errosPorAssunto[0].nome}` : ''
                  }.`
                : 'Continue praticando para recebermos mais dados sobre seu desempenho.'}
            </p>
            <div className="mt-auto flex gap-3 flex-wrap">
              <Link to="/revisao">
                <Button icon={<ArrowRight size={16} />}>Começar revisão</Button>
              </Link>
              <Button variant="secondary" onClick={() => navigate('/simulados')}>
                Novo simulado
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {erradas.length > 0 && (
        <div className="px-4 lg:px-6 pb-10">
          <Card>
            <CardHeader title="Questões que você errou" subtitle="Clique para entender cada erro em detalhe" />
            <CardBody className="flex flex-col gap-2">
              {erradas.map((q) => (
                <button
                  key={q.id}
                  onClick={() => navigate(`/questao/${q.id}?attempt=att-${simulado.id}-${q.id}`)}
                  className="flex items-center justify-between surface-2 rounded-xl p-3 text-left hover:bg-[var(--border)]/30"
                >
                  <span className="text-sm line-clamp-1">{q.enunciado}</span>
                  <Eye size={16} className="text-muted shrink-0 ml-3" />
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      <div className="px-4 lg:px-6 text-xs text-muted flex items-center gap-1.5 pb-6">
        <Clock size={13} /> Tempo médio estimado por questão calculado a partir das suas respostas registradas.
      </div>
    </div>
  )
}
