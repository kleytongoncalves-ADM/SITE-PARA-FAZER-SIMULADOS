import type { Attempt, Dificuldade, ModoSimulado, Question } from './types'

export interface SimuladoFiltros {
  modo: ModoSimulado
  quantidade: number
  disciplinaIds: string[]
  assuntoIds: string[]
  dificuldade: Dificuldade | 'todas'
  modoProva: boolean
  tempoLimiteMinutos: number
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function selecionarQuestoes(banco: Question[], attempts: Attempt[], filtros: SimuladoFiltros): Question[] {
  let pool = [...banco]

  if (filtros.disciplinaIds.length > 0) {
    pool = pool.filter((q) => filtros.disciplinaIds.includes(q.disciplinaId))
  }
  if (filtros.assuntoIds.length > 0) {
    pool = pool.filter((q) => filtros.assuntoIds.includes(q.assuntoId))
  }
  if (filtros.dificuldade !== 'todas') {
    pool = pool.filter((q) => q.dificuldade === filtros.dificuldade)
  }

  const idsErradas = new Set(attempts.filter((a) => !a.correta).map((a) => a.questionId))
  const idsRespondidas = new Set(attempts.map((a) => a.questionId))

  switch (filtros.modo) {
    case 'erros':
      pool = pool.filter((q) => idsErradas.has(q.id))
      break
    case 'ineditas':
      pool = pool.filter((q) => !idsRespondidas.has(q.id))
      break
    case 'revisao': {
      const assuntosComErro = new Set(attempts.filter((a) => !a.correta).map((a) => a.assuntoId))
      pool = pool.filter((q) => assuntosComErro.has(q.assuntoId))
      break
    }
    case 'estilo-banca':
      pool = pool.filter((q) => q.origem === 'estilo-banca' || q.origem === 'oficial')
      break
    default:
      break
  }

  if (pool.length === 0) pool = [...banco]

  // Inteligência adaptativa: prioriza pontos fracos (70/20/10) quando modo completo/personalizado
  if (filtros.modo === 'completo' || filtros.modo === 'personalizado') {
    const acertoPorAssunto = new Map<string, number>()
    for (const q of banco) {
      const tentativas = attempts.filter((a) => a.assuntoId === q.assuntoId)
      const taxa = tentativas.length > 0 ? tentativas.filter((a) => a.correta).length / tentativas.length : 0.7
      acertoPorAssunto.set(q.assuntoId, taxa)
    }
    const fracos = pool.filter((q) => (acertoPorAssunto.get(q.assuntoId) ?? 0.7) < 0.6)
    const medios = pool.filter((q) => {
      const t = acertoPorAssunto.get(q.assuntoId) ?? 0.7
      return t >= 0.6 && t < 0.85
    })
    const fortes = pool.filter((q) => (acertoPorAssunto.get(q.assuntoId) ?? 0.7) >= 0.85)

    const nFracos = Math.round(filtros.quantidade * 0.7)
    const nMedios = Math.round(filtros.quantidade * 0.2)
    const nFortes = filtros.quantidade - nFracos - nMedios

    const selecionadas = [
      ...shuffle(fracos).slice(0, nFracos),
      ...shuffle(medios).slice(0, nMedios),
      ...shuffle(fortes).slice(0, nFortes),
    ]
    if (selecionadas.length < filtros.quantidade) {
      const restantes = shuffle(pool.filter((q) => !selecionadas.includes(q)))
      selecionadas.push(...restantes.slice(0, filtros.quantidade - selecionadas.length))
    }
    return shuffle(selecionadas).slice(0, filtros.quantidade)
  }

  return shuffle(pool).slice(0, filtros.quantidade)
}

export const modoLabels: Record<ModoSimulado, string> = {
  completo: 'Simulado completo',
  disciplina: 'Por disciplina',
  assunto: 'Por assunto',
  erros: 'Apenas questões que errei',
  revisao: 'Revisão inteligente',
  dificeis: 'Questões difíceis',
  faceis: 'Questões fáceis',
  ineditas: 'Questões inéditas',
  'estilo-banca': 'Simulado estilo banca',
  personalizado: 'Simulado personalizado',
}
