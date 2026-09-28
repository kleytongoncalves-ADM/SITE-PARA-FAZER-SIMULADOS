import type { Attempt, Disciplina } from './types'
import { computeMastery, groupBy } from './utils'

export function overallStats(attempts: Attempt[]) {
  const total = attempts.length
  const acertos = attempts.filter((a) => a.correta).length
  const erros = total - acertos
  const percent = total > 0 ? (acertos / total) * 100 : 0
  const tempoMedio = total > 0 ? attempts.reduce((s, a) => s + a.tempoSegundos, 0) / total : 0
  return { total, acertos, erros, percent, tempoMedio }
}

export function statsPorDisciplina(attempts: Attempt[], disciplinas: Disciplina[]) {
  const porDisciplina = groupBy(attempts, (a) => a.disciplinaId)
  return disciplinas.map((d) => {
    const list = porDisciplina[d.id] ?? []
    const acertos = list.filter((a) => a.correta).length
    const percent = list.length > 0 ? (acertos / list.length) * 100 : 0
    return { disciplina: d, total: list.length, acertos, percent, mastery: computeMastery(list) }
  })
}

export function statsPorAssunto(attempts: Attempt[], disciplinas: Disciplina[]) {
  const porAssunto = groupBy(attempts, (a) => a.assuntoId)
  const rows: { disciplina: Disciplina; assuntoId: string; assuntoNome: string; total: number; acertos: number; percent: number; mastery: ReturnType<typeof computeMastery> }[] = []
  for (const d of disciplinas) {
    for (const a of d.assuntos) {
      const list = porAssunto[a.id] ?? []
      const acertos = list.filter((x) => x.correta).length
      const percent = list.length > 0 ? (acertos / list.length) * 100 : 0
      rows.push({ disciplina: d, assuntoId: a.id, assuntoNome: a.nome, total: list.length, acertos, percent, mastery: computeMastery(list) })
    }
  }
  return rows
}

export function evolucaoDiaria(attempts: Attempt[], dias = 14) {
  const now = new Date()
  const result: { data: string; label: string; percent: number; total: number }[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toDateString()
    const doDia = attempts.filter((a) => new Date(a.data).toDateString() === key)
    const acertos = doDia.filter((a) => a.correta).length
    result.push({
      data: key,
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      percent: doDia.length > 0 ? Math.round((acertos / doDia.length) * 100) : 0,
      total: doDia.length,
    })
  }
  return result
}

export function pontoFraco(attempts: Attempt[], disciplinas: Disciplina[]) {
  const rows = statsPorAssunto(attempts, disciplinas).filter((r) => r.total >= 3)
  if (rows.length === 0) return null
  return rows.sort((a, b) => a.percent - b.percent)[0]
}

export function proximoRecomendado(attempts: Attempt[], disciplinas: Disciplina[]) {
  const rows = statsPorAssunto(attempts, disciplinas).filter((r) => r.total >= 2 && r.percent < 70)
  if (rows.length === 0) return statsPorAssunto(attempts, disciplinas)[0] ?? null
  return rows.sort((a, b) => a.percent - b.percent)[1] ?? rows[0]
}

export function assuntosDominados(attempts: Attempt[], disciplinas: Disciplina[]) {
  const rows = statsPorAssunto(attempts, disciplinas)
  const dominados = rows.filter((r) => r.mastery.percent >= 75).length
  return { dominados, total: rows.length }
}

export function errosRecorrentes(attempts: Attempt[], disciplinas: Disciplina[]) {
  const errosPorAssunto = groupBy(
    attempts.filter((a) => !a.correta),
    (a) => a.assuntoId,
  )
  const rows = Object.entries(errosPorAssunto)
    .map(([assuntoId, list]) => {
      let disciplina: Disciplina | undefined
      let nome = assuntoId
      for (const d of disciplinas) {
        const a = d.assuntos.find((x) => x.id === assuntoId)
        if (a) {
          disciplina = d
          nome = a.nome
          break
        }
      }
      return { assuntoId, nome, disciplina, quantidade: list.length, attempts: list }
    })
    .filter((r) => r.quantidade >= 2)
    .sort((a, b) => b.quantidade - a.quantidade)
  return rows
}
