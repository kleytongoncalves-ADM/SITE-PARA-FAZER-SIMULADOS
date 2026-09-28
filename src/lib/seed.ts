import type { Attempt, Question } from './types'

// Gera um histórico realista de estudo dos últimos dias para popular o dashboard
// assim que o onboarding é concluído — dados de demonstração, não reais.
export function gerarHistoricoSeed(bancoQuestoes: Question[]): Attempt[] {
  const attempts: Attempt[] = []
  const hoje = new Date()
  let idCounter = 0

  const pesosPorDisciplina: Record<string, number> = {}
  for (const q of bancoQuestoes) pesosPorDisciplina[q.disciplinaId] = (pesosPorDisciplina[q.disciplinaId] || 0) + 1

  // Perfil de desempenho simulado: forte em Português/Ética, mediano em Adm. Pública,
  // fraco em Raciocínio Lógico e no assunto "Crase" especificamente — usado para
  // demonstrar o "ponto fraco" no dashboard e a inteligência adaptativa.
  const taxaAcertoPorDisciplina: Record<string, number> = {
    portugues: 0.82,
    'legislacao-cra': 0.7,
    'adm-publica': 0.66,
    'raciocinio-logico': 0.48,
    informatica: 0.78,
    etica: 0.88,
  }

  for (let dia = 13; dia >= 0; dia--) {
    const data = new Date(hoje)
    data.setDate(data.getDate() - dia)
    if (dia % 4 === 3) continue // dia de descanso ocasional

    const questoesDoDia = 12 + Math.floor(Math.random() * 10)
    for (let i = 0; i < questoesDoDia; i++) {
      const q = bancoQuestoes[Math.floor(Math.random() * bancoQuestoes.length)]
      const isCrase = q.assuntoId === 'portugues-10'
      let taxa = taxaAcertoPorDisciplina[q.disciplinaId] ?? 0.7
      if (isCrase) taxa = 0.35
      // Evolução: desempenho melhora levemente com o tempo (dias mais recentes = melhor)
      taxa = Math.min(0.95, taxa + (13 - dia) * 0.006)
      const correta = Math.random() < taxa
      const horario = new Date(data)
      horario.setHours(8 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60))

      idCounter += 1
      attempts.push({
        id: `seed-${idCounter}`,
        questionId: q.id,
        disciplinaId: q.disciplinaId,
        assuntoId: q.assuntoId,
        respostaEscolhida: correta ? q.respostaCorreta : q.alternativas.find((a) => a.letra !== q.respostaCorreta)!.letra,
        correta,
        tempoSegundos: 20 + Math.floor(Math.random() * 90),
        data: horario.toISOString(),
      })
    }
  }

  return attempts
}
