import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Target, ListChecks, CheckCircle2, XCircle, Flame, Trophy, ArrowRight } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MasteryBar } from '@/components/ui/ProgressBar'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo, concurso } from '@/lib/data/edital'
import {
  overallStats,
  statsPorDisciplina,
  evolucaoDiaria,
  pontoFraco,
  proximoRecomendado,
  assuntosDominados,
} from '@/lib/analytics'
import { currentStreak, formatPercent } from '@/lib/utils'

export function Dashboard() {
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const cargo = concurso.cargos.find((c) => c.id === onboarding.cargoId)

  const stats = useMemo(() => overallStats(attempts), [attempts])
  const porDisciplina = useMemo(() => statsPorDisciplina(attempts, disciplinas), [attempts, disciplinas])
  const evolucao = useMemo(() => evolucaoDiaria(attempts), [attempts])
  const fraco = useMemo(() => pontoFraco(attempts, disciplinas), [attempts, disciplinas])
  const recomendado = useMemo(() => proximoRecomendado(attempts, disciplinas), [attempts, disciplinas])
  const dominio = useMemo(() => assuntosDominados(attempts, disciplinas), [attempts, disciplinas])
  const streak = useMemo(() => currentStreak(attempts.map((a) => a.data)), [attempts])

  const diasParaProva = Math.max(0, Math.ceil((new Date(onboarding.dataProva).getTime() - Date.now()) / 86400000))

  const radarData = porDisciplina.map((p) => ({ disciplina: p.disciplina.nome.split(' ').slice(0, 2).join(' '), percent: Math.round(p.percent) }))

  return (
    <div>
      <PageHeader
        title={`Olá! Faltam ${diasParaProva} dias para a prova.`}
        subtitle={`${cargo?.nome} · ${concurso.orgao} · Banca ${concurso.banca}`}
        action={
          <Link to="/simulados">
            <Button icon={<ListChecks size={16} />}>Novo simulado</Button>
          </Link>
        }
      />

      <div className="px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Seu desempenho" value={formatPercent(stats.percent, 0)} icon={<Target size={18} />} tone="brand" hint="Taxa de acerto geral" />
        <StatCard label="Questões resolvidas" value={stats.total} icon={<ListChecks size={18} />} tone="accent" />
        <StatCard label="Acertos" value={stats.acertos} icon={<CheckCircle2 size={18} />} tone="success" />
        <StatCard label="Erros" value={stats.erros} icon={<XCircle size={18} />} tone="danger" />
      </div>

      <div className="px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <StatCard label="Sequência atual" value={`${streak} dias`} icon={<Flame size={18} />} tone="warning" />
        <StatCard label="Assuntos dominados" value={`${dominio.dominados}/${dominio.total}`} icon={<Trophy size={18} />} tone="brand" />
        <Card className="p-5 col-span-2 flex flex-col justify-between">
          <span className="text-muted text-sm font-medium">Seu ponto fraco</span>
          {fraco ? (
            <>
              <div className="font-display text-xl font-bold mt-1">{fraco.assuntoNome}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted">{fraco.disciplina.nome}</span>
                <span className="text-xs font-semibold text-danger-500">{Math.round(fraco.percent)}% de acerto</span>
              </div>
            </>
          ) : (
            <div className="text-muted text-sm mt-2">Resolva mais questões para identificarmos seus pontos fracos.</div>
          )}
        </Card>
      </div>

      <div className="px-4 lg:px-6 grid lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Evolução de acertos" subtitle="Últimos 14 dias" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucao} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="colorPercent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand-500)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                  formatter={(value, _n, item) => [`${value}% (${item.payload.total} questões)`, 'Acerto']}
                />
                <Area type="monotone" dataKey="percent" stroke="var(--color-brand-500)" strokeWidth={2} fill="url(#colorPercent)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Desempenho por disciplina" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="disciplina" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Radar dataKey="percent" stroke="var(--color-brand-500)" fill="var(--color-brand-500)" fillOpacity={0.35} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-4 mt-6 pb-8">
        <Card>
          <CardHeader title="Domínio por disciplina" subtitle="Calculado com base nos seus últimos acertos" />
          <CardBody className="flex flex-col gap-4">
            {porDisciplina.map((p) => (
              <MasteryBar key={p.disciplina.id} label={p.disciplina.nome} percent={p.mastery.percent} color={p.disciplina.cor} />
            ))}
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-brand-600 to-brand-800 text-white border-none">
          <CardBody className="pt-5 flex flex-col gap-4 h-full">
            <span className="text-white/70 text-sm font-medium">Próximo estudo recomendado</span>
            <div className="font-display text-2xl font-bold">{recomendado?.assuntoNome ?? 'Continue estudando'}</div>
            <p className="text-white/80 text-sm">
              {recomendado
                ? `Você está com ${Math.round(recomendado.percent)}% de acerto em ${recomendado.disciplina.nome}. Reforce esse assunto agora.`
                : 'Resolva algumas questões para recebermos dados suficientes.'}
            </p>
            <Link to="/revisao" className="mt-auto">
              <Button variant="secondary" className="!bg-white !text-brand-700 hover:!bg-white/90" icon={<ArrowRight size={16} />}>
                Começar revisão
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
