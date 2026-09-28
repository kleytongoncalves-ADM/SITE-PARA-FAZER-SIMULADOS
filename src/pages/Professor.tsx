import { useMemo, useRef, useState } from 'react'
import { GraduationCap, Send, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/lib/store'
import { disciplinasPorCargo } from '@/lib/data/edital'
import { pontoFraco, proximoRecomendado, overallStats } from '@/lib/analytics'
import { cn } from '@/lib/utils'

interface Mensagem {
  autor: 'usuario' | 'professor'
  texto: string
}

const sugestoes = [
  'Não entendi essa matéria.',
  'Me dê outro exemplo.',
  'Crie 5 questões para eu treinar isso.',
  'Explique como se eu nunca tivesse estudado.',
  'Qual regra preciso memorizar?',
  'Me teste novamente.',
]

export function Professor() {
  const attempts = useAppStore((s) => s.attempts)
  const onboarding = useAppStore((s) => s.onboarding)
  const disciplinas = useMemo(() => disciplinasPorCargo(onboarding.cargoId), [onboarding.cargoId])
  const fraco = useMemo(() => pontoFraco(attempts, disciplinas), [attempts, disciplinas])
  const recomendado = useMemo(() => proximoRecomendado(attempts, disciplinas), [attempts, disciplinas])
  const stats = useMemo(() => overallStats(attempts), [attempts])

  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      autor: 'professor',
      texto: `Olá! Sou seu professor particular digital. Já vi seu histórico: você tem ${Math.round(
        stats.percent,
      )}% de acerto geral e seu ponto mais frágil hoje é "${fraco?.assuntoNome ?? 'ainda coletando dados'}". Em que posso te ajudar agora?`,
    },
  ])
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  function responderComoProfessor(pergunta: string): string {
    const p = pergunta.toLowerCase()
    if (p.includes('não entendi') || p.includes('nao entendi')) {
      return `Sem problema. Vamos do zero: ${fraco?.assuntoNome ?? 'esse assunto'} costuma confundir por causa de regras que parecem exceção. Quer que eu explique com uma analogia do dia a dia ou prefere passo a passo formal?`
    }
    if (p.includes('exemplo')) {
      return `Aqui vai outro exemplo prático sobre "${fraco?.assuntoNome ?? recomendado?.assuntoNome ?? 'o assunto atual'}": pense em uma situação do seu dia a dia que exige aplicar exatamente essa regra — isso ajuda a fixar o padrão de raciocínio, não só a resposta certa.`
    }
    if (p.includes('crie') && p.includes('questões')) {
      return `Vou gerar 5 questões de treino sobre "${recomendado?.assuntoNome ?? 'seu próximo assunto recomendado'}". Vá em Simulados → Por assunto para resolvê-las agora com correção imediata.`
    }
    if (p.includes('iniciante') || p.includes('nunca tivesse estudado')) {
      return `Ok, começando do absoluto zero: primeiro entenda o "porquê" da regra antes da regra em si. Depois praticamos com casos simples e só então avançamos para os casos que a banca usa como pegadinha.`
    }
    if (p.includes('regra') || p.includes('memorizar')) {
      return `A regra que você deve guardar sobre "${fraco?.assuntoNome ?? 'esse tema'}" é: identifique o padrão central primeiro, depois procure exceções — a banca sempre testa a exceção, não a regra geral.`
    }
    if (p.includes('teste')) {
      return `Combinado. Acesse "Meus Erros" e escolha um item marcado como "Precisa revisar" — vou te dar uma questão semelhante para confirmar se o aprendizado já está consolidado.`
    }
    return `Boa pergunta. Com base no seu histórico, recomendo focar em "${recomendado?.assuntoNome ?? fraco?.assuntoNome ?? 'revisão geral'}" agora. Quer que eu monte uma sessão de revisão de 15 minutos sobre isso?`
  }

  function enviar(texto?: string) {
    const conteudo = (texto ?? input).trim()
    if (!conteudo) return
    const resposta = responderComoProfessor(conteudo)
    setMensagens((prev) => [...prev, { autor: 'usuario', texto: conteudo }, { autor: 'professor', texto: resposta }])
    setInput('')
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }))
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      <PageHeader title="Meu Professor" subtitle="Seu professor particular digital, baseado no seu histórico real de estudos." />

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 lg:px-6 flex flex-col gap-3 pb-4">
        {mensagens.map((m, i) => (
          <div key={i} className={cn('flex', m.autor === 'usuario' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                m.autor === 'usuario' ? 'bg-brand-600 text-white rounded-br-sm' : 'surface rounded-bl-sm',
              )}
            >
              {m.autor === 'professor' && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-500 mb-1">
                  <GraduationCap size={13} /> Professor
                </div>
              )}
              {m.texto}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 lg:px-6 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
          {sugestoes.map((s) => (
            <button key={s} onClick={() => enviar(s)} className="shrink-0 surface-2 rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
              <Sparkles size={12} className="text-brand-500" /> {s}
            </button>
          ))}
        </div>
        <Card className="p-2 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
            placeholder="Pergunte qualquer coisa sobre sua preparação..."
            className="flex-1 bg-transparent outline-none px-3 py-2 text-sm"
          />
          <button onClick={() => enviar()} className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0" aria-label="Enviar">
            <Send size={16} />
          </button>
        </Card>
      </div>
    </div>
  )
}
