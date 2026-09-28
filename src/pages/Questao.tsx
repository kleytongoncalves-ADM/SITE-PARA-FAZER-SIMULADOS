import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { QuestionCard } from '@/components/QuestionCard'
import { ExplicacaoErro } from '@/components/ExplicacaoErro'
import { useAppStore } from '@/lib/store'

export function Questao() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const attemptId = searchParams.get('attempt') ?? undefined
  const navigate = useNavigate()
  const getBanco = useAppStore((s) => s.getBanco)
  const attempts = useAppStore((s) => s.attempts)
  const registrarResposta = useAppStore((s) => s.registrarResposta)
  const marcarRevisado = useAppStore((s) => s.marcarRevisado)

  const banco = useMemo(() => getBanco(), [getBanco])
  const question = banco.find((q) => q.id === id)
  const attempt = attemptId ? attempts.find((a) => a.id === attemptId) : attempts.filter((a) => a.questionId === id).slice(-1)[0]

  const [testando, setTestando] = useState(false)
  const [novaQuestaoId, setNovaQuestaoId] = useState<string | null>(null)
  const [respostaTeste, setRespostaTeste] = useState<string | undefined>(undefined)

  if (!question) {
    return (
      <div className="p-6">
        <p className="text-muted">Questão não encontrada.</p>
      </div>
    )
  }

  function iniciarTeste() {
    const similares = banco.filter((q) => q.assuntoId === question!.assuntoId && q.id !== question!.id)
    const escolhida = similares[Math.floor(Math.random() * similares.length)]
    setNovaQuestaoId(escolhida?.id ?? null)
    setRespostaTeste(undefined)
    setTestando(true)
    if (attempt) marcarRevisado(attempt.id)
  }

  const questaoTeste = novaQuestaoId ? banco.find((q) => q.id === novaQuestaoId) : null

  function responderTeste(letra: string) {
    setRespostaTeste(letra)
    if (questaoTeste) {
      registrarResposta({
        id: `att-teste-${Date.now()}`,
        questionId: questaoTeste.id,
        disciplinaId: questaoTeste.disciplinaId,
        assuntoId: questaoTeste.assuntoId,
        respostaEscolhida: letra,
        correta: letra === questaoTeste.respostaCorreta,
        tempoSegundos: 30,
        data: new Date().toISOString(),
      })
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted mb-4 hover:text-[var(--text)]">
        <ChevronLeft size={16} /> Voltar
      </button>

      {!testando && (
        <>
          <QuestionCard question={question} numero={1} total={1} respostaSelecionada={attempt?.respostaEscolhida} mostrarGabarito />
          {attempt && !attempt.correta && (
            <div className="mt-4">
              <ExplicacaoErro question={question} respostaEscolhida={attempt.respostaEscolhida} attemptId={attempt.id} professorMode onTestarAprendizado={iniciarTeste} />
            </div>
          )}
        </>
      )}

      {testando && questaoTeste && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-brand-500 font-semibold text-sm">
            <Sparkles size={16} /> Questão semelhante para testar seu aprendizado
          </div>
          <QuestionCard
            question={questaoTeste}
            numero={1}
            total={1}
            respostaSelecionada={respostaTeste}
            onSelecionar={responderTeste}
            mostrarGabarito={!!respostaTeste}
          />
          {respostaTeste && (
            <div className="surface rounded-2xl p-5 flex items-center justify-between">
              {respostaTeste === questaoTeste.respostaCorreta ? (
                <span className="text-success-500 font-semibold">🎉 Isso! Agora você entendeu o conceito.</span>
              ) : (
                <span className="text-danger-500 font-semibold">Ainda não. Vamos reforçar esse conceito de outra forma.</span>
              )}
              <Button variant="secondary" onClick={() => navigate('/erros')}>
                Voltar aos meus erros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
