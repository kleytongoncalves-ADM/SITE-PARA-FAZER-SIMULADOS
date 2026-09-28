export type Dificuldade = 'facil' | 'media' | 'dificil'

export type OrigemQuestao = 'oficial' | 'adaptada' | 'gerada' | 'estilo-banca'

export interface Alternativa {
  letra: string
  texto: string
  comentario: string
}

export interface Question {
  id: string
  disciplinaId: string
  assuntoId: string
  enunciado: string
  alternativas: Alternativa[]
  respostaCorreta: string
  dificuldade: Dificuldade
  banca: string
  ano: number
  origem: OrigemQuestao
  tags: string[]
  explicacao: {
    conceito: string
    raciocinio: string[]
    porQueErrouTemplate: string
    porQueCorretaEstaCerta: string
    pegadinha: string
    regraParaGuardar: string
    exemplo: string
  }
}

export interface Assunto {
  id: string
  disciplinaId: string
  nome: string
}

export interface Disciplina {
  id: string
  nome: string
  cor: string
  peso: number
  numQuestoesEdital: number
  assuntos: Assunto[]
}

export interface Cargo {
  id: string
  codigo: string
  nome: string
  nivel: 'medio' | 'superior'
  salario: number
  vagasImediatas: number
  vagasCadastroReserva: number
  requisitos: string
  descricao: string
}

export interface Concurso {
  id: string
  nome: string
  orgao: string
  banca: string
  edital: string
  dataProva: string
  duracaoProvaHoras: number
  notaMinimaPercent: number
  cargos: Cargo[]
  disciplinas: Disciplina[]
  cronograma: { item: string; data: string }[]
}

export type MotivoErro =
  | 'falta-conhecimento'
  | 'falta-atencao'
  | 'interpretacao'
  | 'confusao-conceitos'
  | 'pegadinha'
  | 'falta-tempo'
  | 'chute'

export interface Attempt {
  id: string
  questionId: string
  disciplinaId: string
  assuntoId: string
  respostaEscolhida: string
  correta: boolean
  tempoSegundos: number
  data: string
  simuladoId?: string
  motivoErro?: MotivoErro
  revisado?: boolean
}

export type ModoSimulado =
  | 'completo'
  | 'disciplina'
  | 'assunto'
  | 'erros'
  | 'revisao'
  | 'dificeis'
  | 'faceis'
  | 'ineditas'
  | 'estilo-banca'
  | 'personalizado'

export interface Simulado {
  id: string
  titulo: string
  modo: ModoSimulado
  modoProva: boolean
  questoesIds: string[]
  tempoLimiteMinutos: number
  criadoEm: string
  concluidoEm?: string
  respostas: Record<string, string>
  marcadas: string[]
}

export interface StudyPlanDay {
  dia: string
  blocos: { horario: string; atividade: string; disciplinaId?: string }[]
}

export interface StudyPlan {
  dataProva: string
  horasPorDia: number
  diasPorSemana: number
  prioridades: string[]
  cronograma: StudyPlanDay[]
}

export interface Achievement {
  id: string
  titulo: string
  descricao: string
  icone: string
  conquistadoEm?: string
  progresso: number
  meta: number
}
