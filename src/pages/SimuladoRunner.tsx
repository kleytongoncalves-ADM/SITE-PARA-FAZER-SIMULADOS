import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, Flag, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { QuestionCard } from '@/components/QuestionCard'
import { ExplicacaoErro } from '@/components/ExplicacaoErro'
import { useAppStore } from '@/lib/store'
import { cn, formatClock } from '@/lib/utils'
import type { Attempt } from '@/lib/types'

export function SimuladoRunner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const simulados = useAppStore((s) => s.simulados)
  const getBanco = useAppStore((s) => s.getBanco)
  const registrarResposta = useAppStore((s) => s.registrarResposta)
  const finalizarSimulado = useAppStore((s) => s.finalizarSimulado)

  const simulado = simulados.find((s) => s.id === id)
  const banco = getBanco()
  const questoes = useMemo(() => (simulado ? simulado.questoesIds.map((qid) => banco.find((q) => q.id === qid)!) : []), [simulado, banco])

  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [tempoRestante, setTempoRestante] = useState((simulado?.tempoLimiteMinutos ?? 30) * 60)
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [finalizado, setFinalizado] = useState(false)

  const questaoAtual = questoes[indice]

  useEffect(() => {
    if (finalizado || !simulado?.modoProva) return
    if (tempoRestante <= 0) {
      finalizar()
      return
    }
    const t = setTimeout(() => setTempoRestante((v) => v - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempoRestante, finalizado])

  if (!simulado || questoes.length === 0 || !questaoAtual) {
    return (
      <div className="p-6">
        <p className="text-muted">Simulado não encontrado.</p>
        <Button className="mt-4" onClick={() => navigate('/simulados')}>
          Voltar
        </Button>
      </div>
    )
  }

  function selecionarResposta(letra: string) {
    setRespostas((prev) => ({ ...prev, [questaoAtual.id]: letra }))
    if (!simulado!.modoProva) setMostrarExplicacao(true)
  }

  function irPara(novoIndice: number) {
    setMostrarExplicacao(false)
    setIndice(Math.max(0, Math.min(questoes.length - 1, novoIndice)))
  }

  function toggleMarcar() {
    setMarcadas((prev) => (prev.includes(questaoAtual.id) ? prev.filter((x) => x !== questaoAtual.id) : [...prev, questaoAtual.id]))
  }

  function finalizar() {
    const attempts: Attempt[] = questoes
      .filter((q) => respostas[q.id])
      .map((q) => ({
        id: `att-${simulado!.id}-${q.id}`,
        questionId: q.id,
        disciplinaId: q.disciplinaId,
        assuntoId: q.assuntoId,
        respostaEscolhida: respostas[q.id],
        correta: respostas[q.id] === q.respostaCorreta,
        tempoSegundos: 60,
        data: new Date().toISOString(),
        simuladoId: simulado!.id,
      }))
    attempts.forEach(registrarResposta)
    finalizarSimulado(simulado!.id, respostas)
    setFinalizado(true)
    navigate(`/resultados/${simulado!.id}`)
  }

  const respondidas = Object.keys(respostas).length
  const tempoCritico = simulado.modoProva && tempoRestante < 300

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{simulado.titulo}</h1>
          <p className="text-sm text-muted">
            {respondidas}/{questoes.length} respondidas
          </p>
        </div>
        {simulado.modoProva && (
          <div className={cn('flex items-center gap-2 px-4 py-2 rounded-xl surface font-mono font-bold tabular-nums', tempoCritico && 'text-danger-500 animate-pulse')}>
            <Clock size={18} />
            {formatClock(tempoRestante)}
          </div>
        )}
      </div>

      <div className="w-full h-1.5 rounded-full surface-2 mb-6 overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((indice + 1) / questoes.length) * 100}%` }} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {questoes.map((q, i) => (
          <button
            key={q.id}
            onClick={() => irPara(i)}
            className={cn(
              'w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center relative',
              i === indice ? 'bg-brand-600 text-white' : respostas[q.id] ? 'bg-success-500/20 text-success-500' : 'surface-2 text-muted',
            )}
          >
            {i + 1}
            {marcadas.includes(q.id) && <Flag size={9} className="absolute -top-1 -right-1 text-warning-500" fill="currentColor" />}
          </button>
        ))}
      </div>

      <QuestionCard
        question={questaoAtual}
        numero={indice + 1}
        total={questoes.length}
        respostaSelecionada={respostas[questaoAtual.id]}
        onSelecionar={selecionarResposta}
        mostrarGabarito={!simulado.modoProva && mostrarExplicacao}
        marcada={marcadas.includes(questaoAtual.id)}
        onToggleMarcar={toggleMarcar}
      />

      {!simulado.modoProva && mostrarExplicacao && respostas[questaoAtual.id] !== questaoAtual.respostaCorreta && (
        <div className="mt-4">
          <ExplicacaoErro question={questaoAtual} respostaEscolhida={respostas[questaoAtual.id]} professorMode />
        </div>
      )}

      <div className="flex items-center justify-between mt-6 gap-3">
        <Button variant="secondary" icon={<ChevronLeft size={16} />} onClick={() => irPara(indice - 1)} disabled={indice === 0}>
          Anterior
        </Button>
        {indice === questoes.length - 1 ? (
          <Button variant="success" icon={<Send size={16} />} onClick={finalizar}>
            Finalizar simulado
          </Button>
        ) : (
          <Button icon={<ChevronRight size={16} />} onClick={() => irPara(indice + 1)}>
            Próxima
          </Button>
        )}
      </div>
    </div>
  )
}
