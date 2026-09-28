import { useMemo } from 'react'
import { Flame, Trophy, Star, Award } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/lib/store'
import { concurso } from '@/lib/data/edital'
import { overallStats } from '@/lib/analytics'
import { currentStreak, levelFromXp, xpForAttempt, cn } from '@/lib/utils'

export function Perfil() {
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const achievements = useAppStore((s) => s.achievements)
  const stats = useMemo(() => overallStats(attempts), [attempts])
  const streak = useMemo(() => currentStreak(attempts.map((a) => a.data)), [attempts])
  const xp = useMemo(() => attempts.reduce((sum, a) => sum + xpForAttempt(a), 0), [attempts])
  const { level, xpInLevel, xpToNext } = levelFromXp(xp)
  const cargo = concurso.cargos.find((c) => c.id === onboarding.cargoId)

  const conquistas = achievements.map((a) => {
    let progresso = a.progresso
    if (a.id === 'primeiras-100' || a.id === 'quinhentas') progresso = stats.total
    if (a.id === 'sete-dias') progresso = streak
    const conquistado = progresso >= a.meta
    return { ...a, progresso, conquistado }
  })

  return (
    <div>
      <PageHeader title="Meu perfil" subtitle="Sua jornada de preparação, de forma elegante e sem infantilizar." />

      <div className="px-4 lg:px-6 grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-display font-bold text-2xl mb-3">
            {level}
          </div>
          <div className="font-display font-bold text-lg">Nível {level}</div>
          <div className="text-xs text-muted mb-3">{xpInLevel}/{xpToNext} XP para o próximo nível</div>
          <ProgressBar value={(xpInLevel / xpToNext) * 100} className="w-full" />
          <div className="flex items-center gap-2 mt-4">
            <Badge tone="warning">
              <Flame size={12} /> {streak} dias seguidos
            </Badge>
            <Badge tone="brand">{cargo?.nome}</Badge>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Resumo" subtitle={`${concurso.orgao} · ${concurso.banca}`} />
          <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-display font-bold">{stats.total}</div>
              <div className="text-xs text-muted">Questões resolvidas</div>
            </div>
            <div>
              <div className="text-2xl font-display font-bold">{Math.round(stats.percent)}%</div>
              <div className="text-xs text-muted">Taxa de acerto</div>
            </div>
            <div>
              <div className="text-2xl font-display font-bold">{xp}</div>
              <div className="text-xs text-muted">XP acumulado</div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="px-4 lg:px-6 mt-6 pb-10">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Trophy size={16} /> Conquistas</span>} />
          <CardBody className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {conquistas.map((a) => (
              <div
                key={a.id}
                className={cn('surface-2 rounded-2xl p-4 flex flex-col gap-2', a.conquistado && 'ring-2 ring-brand-500/50')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{a.icone}</span>
                  {a.conquistado ? <Star size={16} className="text-warning-500" fill="currentColor" /> : <Award size={16} className="text-muted" />}
                </div>
                <div className="font-semibold text-sm">{a.titulo}</div>
                <div className="text-xs text-muted">{a.descricao}</div>
                <ProgressBar value={Math.min(100, (a.progresso / a.meta) * 100)} />
                <div className="text-xs text-muted text-right">
                  {Math.min(a.progresso, a.meta)}/{a.meta}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
