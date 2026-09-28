import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, Layers, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo, bancaEstiloInfo } from '@/lib/data/edital'
import { selecionarQuestoes, modoLabels, type SimuladoFiltros } from '@/lib/simuladoBuilder'
import type { Dificuldade, ModoSimulado, Simulado } from '@/lib/types'

const modos: { modo: ModoSimulado; descricao: string }[] = [
  { modo: 'completo', descricao: 'Todas as disciplinas, priorizando seus pontos fracos.' },
  { modo: 'disciplina', descricao: 'Escolha uma ou mais disciplinas específicas.' },
  { modo: 'assunto', descricao: 'Foque em assuntos específicos dentro de uma disciplina.' },
  { modo: 'erros', descricao: 'Só questões que você já errou antes.' },
  { modo: 'revisao', descricao: 'Assuntos com erros recentes, para fixar o conteúdo.' },
  { modo: 'dificeis', descricao: 'Apenas questões classificadas como difíceis.' },
  { modo: 'faceis', descricao: 'Questões fáceis, ideais para aquecer.' },
  { modo: 'ineditas', descricao: 'Questões que você ainda não viu.' },
  { modo: 'estilo-banca', descricao: bancaEstiloInfo },
  { modo: 'personalizado', descricao: 'Combine todos os filtros manualmente.' },
]

const tempos = [15, 30, 45, 60, 90, 120]

export function Simulados() {
  const navigate = useNavigate()
  const onboarding = useAppStore((s) => s.onboarding)
  const attempts = useAppStore((s) => s.attempts)
  const criarSimulado = useAppStore((s) => s.criarSimulado)
  const getBanco = useAppStore((s) => s.getBanco)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])

  const [modo, setModo] = useState<ModoSimulado>('completo')
  const [quantidade, setQuantidade] = useState(20)
  const [disciplinaIds, setDisciplinaIds] = useState<string[]>([])
  const [assuntoIds, setAssuntoIds] = useState<string[]>([])
  const [dificuldade, setDificuldade] = useState<Dificuldade | 'todas'>('todas')
  const [modoProva, setModoProva] = useState(true)
  const [tempoLimiteMinutos, setTempoLimiteMinutos] = useState(30)

  const assuntosDisponiveis = disciplinas.filter((d) => disciplinaIds.includes(d.id)).flatMap((d) => d.assuntos)

  function toggleDisciplina(id: string) {
    setDisciplinaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function toggleAssunto(id: string) {
    setAssuntoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function iniciar() {
    const filtros: SimuladoFiltros = {
      modo,
      quantidade,
      disciplinaIds: modo === 'disciplina' || modo === 'personalizado' ? disciplinaIds : [],
      assuntoIds: modo === 'assunto' || modo === 'personalizado' ? assuntoIds : [],
      dificuldade: modo === 'dificeis' ? 'dificil' : modo === 'faceis' ? 'facil' : dificuldade,
      modoProva,
      tempoLimiteMinutos,
    }
    const banco = getBanco()
    const questoes = selecionarQuestoes(banco, attempts, filtros)
    const simulado: Simulado = {
      id: `sim-${Date.now()}`,
      titulo: modoLabels[modo],
      modo,
      modoProva,
      questoesIds: questoes.map((q) => q.id),
      tempoLimiteMinutos,
      criadoEm: new Date().toISOString(),
      respostas: {},
      marcadas: [],
    }
    criarSimulado(simulado)
    navigate(`/simulado/${simulado.id}`)
  }

  return (
    <div>
      <PageHeader title="Novo simulado" subtitle="Monte um simulado sob medida a partir do edital do seu concurso." />

      <div className="px-4 lg:px-6 grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Tipo de simulado" />
          <CardBody className="grid sm:grid-cols-2 gap-3">
            {modos.map((m) => (
              <button
                key={m.modo}
                onClick={() => setModo(m.modo)}
                className={cn(
                  'text-left rounded-2xl p-4 border-2 transition-colors surface-2',
                  modo === m.modo ? 'border-brand-500' : 'border-transparent hover:border-[var(--border)]',
                )}
              >
                <div className="font-semibold text-sm">{modoLabels[m.modo]}</div>
                <div className="text-xs text-muted mt-1 line-clamp-2">{m.descricao}</div>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Simulado realista" subtitle="Cronômetro, uma questão por vez" />
          <CardBody className="flex flex-col gap-4">
            <label className="flex items-center justify-between surface-2 rounded-xl p-3 cursor-pointer">
              <span className="text-sm font-medium flex items-center gap-2">
                <Clock size={16} /> Modo prova
              </span>
              <input type="checkbox" checked={modoProva} onChange={(e) => setModoProva(e.target.checked)} className="w-5 h-5 accent-brand-500" />
            </label>
            <div>
              <div className="text-sm font-medium mb-2">Tempo de prova</div>
              <div className="flex flex-wrap gap-2">
                {tempos.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTempoLimiteMinutos(t)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium surface-2',
                      tempoLimiteMinutos === t && 'bg-brand-600 text-white',
                    )}
                  >
                    {t < 60 ? `${t} min` : `${t / 60}h`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Quantidade de questões</div>
              <input
                type="range"
                min={5}
                max={70}
                step={5}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="text-right text-sm font-semibold">{quantidade} questões</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {(modo === 'disciplina' || modo === 'personalizado') && (
        <div className="px-4 lg:px-6 mt-4">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Layers size={16} /> Disciplinas</span>} />
            <CardBody className="flex flex-wrap gap-2">
              {disciplinas.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleDisciplina(d.id)}
                  className={cn('px-3 py-1.5 rounded-full text-sm font-medium border', disciplinaIds.includes(d.id) ? 'text-white' : 'surface-2')}
                  style={disciplinaIds.includes(d.id) ? { backgroundColor: d.cor, borderColor: d.cor } : { borderColor: 'var(--border)' }}
                >
                  {d.nome}
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {(modo === 'assunto' || modo === 'personalizado') && disciplinaIds.length > 0 && (
        <div className="px-4 lg:px-6 mt-4">
          <Card>
            <CardHeader title="Assuntos" />
            <CardBody className="flex flex-wrap gap-2">
              {assuntosDisponiveis.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAssunto(a.id)}
                  className={cn('px-3 py-1.5 rounded-full text-sm font-medium', assuntoIds.includes(a.id) ? 'bg-brand-600 text-white' : 'surface-2')}
                >
                  {a.nome}
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {modo === 'personalizado' && (
        <div className="px-4 lg:px-6 mt-4">
          <Card>
            <CardHeader title="Dificuldade" />
            <CardBody className="flex gap-2">
              {(['todas', 'facil', 'media', 'dificil'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDificuldade(d)}
                  className={cn('px-3 py-1.5 rounded-full text-sm font-medium surface-2', dificuldade === d && 'bg-brand-600 text-white')}
                >
                  {d === 'todas' ? 'Todas' : d === 'facil' ? 'Fácil' : d === 'media' ? 'Média' : 'Difícil'}
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {modo === 'estilo-banca' && (
        <div className="px-4 lg:px-6 mt-4">
          <div className="surface-2 rounded-2xl p-4 flex gap-3 items-start">
            <Sparkles size={18} className="text-brand-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted">{bancaEstiloInfo}</p>
          </div>
        </div>
      )}

      <div className="px-4 lg:px-6 mt-6 flex items-center gap-3">
        <Button size="lg" icon={<Play size={18} />} onClick={iniciar}>
          Iniciar simulado
        </Button>
        <Badge tone="neutral">{quantidade} questões · {modoProva ? 'modo prova' : 'modo estudo'}</Badge>
      </div>
    </div>
  )
}
