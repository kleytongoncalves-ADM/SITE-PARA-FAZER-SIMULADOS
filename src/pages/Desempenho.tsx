import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { overallStats, statsPorAssunto, evolucaoDiaria } from '@/lib/analytics'
import { groupBy } from '@/lib/utils'
import { Target, ListChecks, Timer, CalendarCheck } from 'lucide-react'

export function Desempenho() {
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const stats = useMemo(() => overallStats(attempts), [attempts])
  const porAssunto = useMemo(() => statsPorAssunto(attempts, disciplinas).filter((a) => a.total > 0), [attempts, disciplinas])
  const evolucao = useMemo(() => evolucaoDiaria(attempts, 21), [attempts])

  const diasComEstudo = new Set(attempts.map((a) => new Date(a.data).toDateString())).size
  const questoesPorDia = diasComEstudo > 0 ? Math.round(attempts.length / diasComEstudo) : 0

  const porDificuldade = Object.entries(groupBy(attempts, (a) => {
    return a.correta ? 'acerto' : 'erro'
  }))

  const barAssunto = [...porAssunto].sort((a, b) => b.total - a.total).slice(0, 10).map((a) => ({
    nome: a.assuntoNome.length > 18 ? a.assuntoNome.slice(0, 18) + '…' : a.assuntoNome,
    percent: Math.round(a.percent),
    cor: a.disciplina.cor,
  }))

  const mapaErros = [...porAssunto]
    .filter((a) => a.total - a.acertos > 0)
    .sort((a, b) => b.total - b.acertos - (a.total - a.acertos))
    .slice(0, 8)

  const forte = [...porAssunto].sort((a, b) => b.percent - a.percent)[0]
  const fraco = [...porAssunto].sort((a, b) => a.percent - b.percent)[0]

  const perfilTexto =
    forte && fraco
      ? `Você apresenta bom desempenho em ${forte.assuntoNome} (${Math.round(forte.percent)}% de acerto), mas ainda perde pontos em ${fraco.assuntoNome} (${Math.round(
          fraco.percent,
        )}% de acerto). Direcionar sua próxima sessão de estudos para esse assunto tende a gerar o maior ganho de nota.`
      : 'Continue respondendo questões para recebermos dados suficientes sobre seu perfil de aprendizagem.'

  return (
    <div>
      <PageHeader title="Desempenho" subtitle="Análise completa baseada no seu histórico real de respostas." />

      <div className="px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Aproveitamento geral" value={`${Math.round(stats.percent)}%`} icon={<Target size={18} />} />
        <StatCard label="Questões/dia (média)" value={questoesPorDia} icon={<ListChecks size={18} />} tone="accent" />
        <StatCard label="Tempo médio/questão" value={`${Math.round(stats.tempoMedio)}s`} icon={<Timer size={18} />} tone="warning" />
        <StatCard label="Dias de estudo" value={diasComEstudo} icon={<CalendarCheck size={18} />} tone="success" />
      </div>

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader title="Evolução semanal" subtitle="Percentual de acerto — últimos 21 dias" />
          <CardBody className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="percent" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Desempenho por assunto" subtitle="Top 10 assuntos mais praticados" />
          <CardBody className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barAssunto} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="percent" radius={[0, 6, 6, 0]}>
                  {barAssunto.map((b, i) => (
                    <Cell key={i} fill={b.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-4 mt-6 pb-10">
        <Card>
          <CardHeader title="Mapa de erros" subtitle="Assuntos com mais questões erradas" />
          <CardBody className="flex flex-col gap-2">
            {mapaErros.length === 0 && <p className="text-sm text-muted">Nenhum erro relevante registrado ainda.</p>}
            {mapaErros.map((a) => (
              <div key={a.assuntoId} className="flex items-center justify-between surface-2 rounded-xl p-3">
                <div>
                  <div className="text-sm font-medium">{a.assuntoNome}</div>
                  <div className="text-xs text-muted">{a.disciplina.nome}</div>
                </div>
                <div className="text-sm font-bold text-danger-500">{a.total - a.acertos} erro(s)</div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-brand-600 to-brand-800 text-white border-none">
          <CardHeader title="Seu perfil de aprendizagem" className="text-white [&_p]:text-white/70" />
          <CardBody>
            <p className="text-sm leading-relaxed text-white/90">{perfilTexto}</p>
            <div className="flex gap-4 mt-4 text-xs">
              <span>{porDificuldade.find(([k]) => k === 'acerto')?.[1].length ?? 0} acertos totais</span>
              <span>{porDificuldade.find(([k]) => k === 'erro')?.[1].length ?? 0} erros totais</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
