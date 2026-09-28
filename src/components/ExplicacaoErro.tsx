import { useState } from 'react'
import { BookOpen, Brain, Search, XOctagon, Lightbulb, Pencil, Target, CheckCircle2, HelpCircle } from 'lucide-react'
import { Card, CardBody } from './ui/Card'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import type { Question, MotivoErro } from '@/lib/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const motivos: { id: MotivoErro; label: string }[] = [
  { id: 'falta-conhecimento', label: 'Falta de conhecimento' },
  { id: 'falta-atencao', label: 'Falta de atenção' },
  { id: 'interpretacao', label: 'Interpretação' },
  { id: 'confusao-conceitos', label: 'Confusão entre conceitos' },
  { id: 'pegadinha', label: 'Pegadinha' },
  { id: 'falta-tempo', label: 'Falta de tempo' },
  { id: 'chute', label: 'Chute' },
]

type EstiloExplicacao = 'padrao' | 'simples' | 'detalhado' | 'exemplo' | 'iniciante' | 'analogia' | 'passo-a-passo'

export function ExplicacaoErro({
  question,
  respostaEscolhida,
  attemptId,
  onEntendi,
  onTestarAprendizado,
  professorMode,
}: {
  question: Question
  respostaEscolhida: string
  attemptId?: string
  onEntendi?: () => void
  onTestarAprendizado?: () => void
  professorMode?: boolean
}) {
  const definirMotivoErro = useAppStore((s) => s.definirMotivoErro)
  const [motivo, setMotivo] = useState<MotivoErro | null>(null)
  const [estilo, setEstilo] = useState<EstiloExplicacao>('padrao')
  const [entendi, setEntendi] = useState(false)

  const alternativaEscolhida = question.alternativas.find((a) => a.letra === respostaEscolhida)
  const alternativaCorreta = question.alternativas.find((a) => a.letra === question.respostaCorreta)
  const exp = question.explicacao

  function escolherMotivo(m: MotivoErro) {
    setMotivo(m)
    if (attemptId) definirMotivoErro(attemptId, m)
  }

  const origemLabel = {
    oficial: 'Questão oficial',
    adaptada: 'Questão adaptada',
    gerada: 'Questão gerada',
    'estilo-banca': 'Estilo da banca',
  }[question.origem]

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-2 border-danger-500/30">
        <CardBody className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <XOctagon size={20} className="text-danger-500" />
            <h3 className="font-display text-lg font-bold">Entenda seu erro</h3>
            <Badge tone="neutral" className="ml-auto">{origemLabel}</Badge>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl p-3 bg-danger-500/10">
              <div className="text-xs font-semibold text-danger-500 mb-1">❌ Você marcou</div>
              <div className="font-semibold">{respostaEscolhida}. {alternativaEscolhida?.texto}</div>
            </div>
            <div className="rounded-xl p-3 bg-success-500/10">
              <div className="text-xs font-semibold text-success-500 mb-1">✅ Resposta correta</div>
              <div className="font-semibold">{question.respostaCorreta}. {alternativaCorreta?.texto}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle size={18} className="text-brand-500" />
            <h4 className="font-semibold">🔎 Por que eu errei?</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {motivos.map((m) => (
              <button
                key={m.id}
                onClick={() => escolherMotivo(m.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border',
                  motivo === m.id ? 'bg-brand-600 text-white border-brand-600' : 'surface-2 border-[var(--border)]',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-brand-600 dark:text-brand-300">
              <BookOpen size={17} /> <span className="font-semibold text-sm">CONCEITO</span>
            </div>
            <p className="text-sm leading-relaxed">{exp.conceito}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5 text-brand-600 dark:text-brand-300">
              <Brain size={17} /> <span className="font-semibold text-sm">COMO PENSAR</span>
            </div>
            <ol className="text-sm leading-relaxed list-decimal list-inside space-y-1">
              {exp.raciocinio.map((passo, i) => (
                <li key={i}>{passo}</li>
              ))}
            </ol>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5 text-brand-600 dark:text-brand-300">
              <Search size={17} /> <span className="font-semibold text-sm">ANALISANDO A QUESTÃO</span>
            </div>
            <p className="text-sm leading-relaxed">{exp.porQueErrouTemplate}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5 text-danger-500">
              <XOctagon size={17} /> <span className="font-semibold text-sm">POR QUE AS OUTRAS ALTERNATIVAS ESTÃO ERRADAS</span>
            </div>
            <ul className="text-sm leading-relaxed space-y-1.5">
              {question.alternativas
                .filter((a) => a.letra !== question.respostaCorreta)
                .map((a) => (
                  <li key={a.letra} className="flex gap-2">
                    <span className="font-semibold shrink-0">{a.letra}.</span>
                    <span className="text-muted">{a.comentario}</span>
                  </li>
                ))}
            </ul>
            <div className="text-sm leading-relaxed mt-2 flex gap-2 bg-success-500/10 rounded-lg p-2.5">
              <CheckCircle2 size={16} className="text-success-500 shrink-0 mt-0.5" />
              <span>{exp.porQueCorretaEstaCerta}</span>
            </div>
          </div>

          <div className="rounded-xl p-4 bg-warning-500/10">
            <div className="flex items-center gap-2 mb-1.5 text-warning-500">
              <Lightbulb size={17} /> <span className="font-semibold text-sm">MACETE / PEGADINHA</span>
            </div>
            <p className="text-sm leading-relaxed">{exp.pegadinha}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5 text-brand-600 dark:text-brand-300">
              <Pencil size={17} /> <span className="font-semibold text-sm">EXEMPLO</span>
            </div>
            <p className="text-sm leading-relaxed">{exp.exemplo}</p>
          </div>

          <div className="rounded-xl p-4 border-2 border-brand-500/40">
            <div className="flex items-center gap-2 mb-1.5 text-brand-600 dark:text-brand-300">
              <Target size={17} /> <span className="font-semibold text-sm">O QUE VOCÊ PRECISA GUARDAR</span>
            </div>
            <p className="text-sm leading-relaxed font-medium">{exp.regraParaGuardar}</p>
          </div>

          {professorMode && (
            <div>
              <div className="text-xs font-semibold text-muted mb-2">Não entendeu? Explique de outra forma:</div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['simples', 'Mais simples'],
                    ['detalhado', 'Mais detalhado'],
                    ['exemplo', 'Com exemplo'],
                    ['iniciante', 'Como se eu fosse iniciante'],
                    ['analogia', 'Com analogia'],
                    ['passo-a-passo', 'Passo a passo'],
                  ] as [EstiloExplicacao, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setEstilo(id)}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium surface-2', estilo === id && 'bg-brand-600 text-white')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {estilo !== 'padrao' && (
                <div className="mt-3 text-sm surface-2 rounded-xl p-3 text-muted">
                  {estilo === 'simples' && `Em resumo: ${exp.regraParaGuardar}`}
                  {estilo === 'detalhado' && `${exp.conceito} ${exp.raciocinio.join(' Em seguida, ')}`}
                  {estilo === 'exemplo' && exp.exemplo}
                  {estilo === 'iniciante' && `Pense assim, do zero: ${exp.conceito} Ou seja, ${exp.regraParaGuardar.toLowerCase()}`}
                  {estilo === 'analogia' && `Imagine que esse conceito funciona como uma regra do dia a dia: ${exp.regraParaGuardar}`}
                  {estilo === 'passo-a-passo' && exp.raciocinio.map((p, i) => `${i + 1}) ${p}`).join(' ')}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-3 flex-wrap">
        {!entendi ? (
          <Button
            size="lg"
            icon={<CheckCircle2 size={18} />}
            onClick={() => {
              setEntendi(true)
              onEntendi?.()
            }}
          >
            Entendi
          </Button>
        ) : (
          <Button size="lg" variant="success" icon={<Target size={18} />} onClick={onTestarAprendizado}>
            Testar meu aprendizado
          </Button>
        )}
      </div>
    </div>
  )
}
