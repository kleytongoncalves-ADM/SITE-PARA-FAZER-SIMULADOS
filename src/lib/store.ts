import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Achievement, Attempt, MotivoErro, Simulado, StudyPlan } from './types'
import { bancoDeQuestoes } from './data/questions'
import { gerarHistoricoSeed } from './seed'

export type Theme = 'light' | 'dark'

interface OnboardingData {
  concursoId: string
  cargoId: string
  dataProva: string
  horasPorDia: number
}

const achievementsBase: Achievement[] = [
  { id: 'primeiras-100', titulo: '100 questões resolvidas', descricao: 'Resolva 100 questões no total.', icone: '🏆', progresso: 0, meta: 100 },
  { id: 'sete-dias', titulo: '7 dias estudando', descricao: 'Mantenha uma sequência de 7 dias.', icone: '🔥', progresso: 0, meta: 7 },
  { id: 'cem-disciplina', titulo: '100% em uma disciplina', descricao: 'Acerte 100% em um simulado de disciplina.', icone: '🎯', progresso: 0, meta: 1 },
  { id: 'recuperou-critico', titulo: 'Recuperou um assunto crítico', descricao: 'Leve um assunto de Crítico a Dominado.', icone: '🚀', progresso: 0, meta: 1 },
  { id: 'quinhentas', titulo: '500 questões resolvidas', descricao: 'Resolva 500 questões no total.', icone: '💎', progresso: 0, meta: 500 },
]

interface AppState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void

  onboardingConcluido: boolean
  onboarding: OnboardingData
  concluirOnboarding: (data: OnboardingData) => void

  attempts: Attempt[]
  registrarResposta: (attempt: Attempt) => void
  definirMotivoErro: (attemptId: string, motivo: MotivoErro) => void
  marcarRevisado: (attemptId: string) => void

  simulados: Simulado[]
  criarSimulado: (s: Simulado) => void
  finalizarSimulado: (id: string, respostas: Record<string, string>) => void

  favoritos: string[]
  toggleFavorito: (questionId: string) => void

  plano: StudyPlan | null
  definirPlano: (p: StudyPlan) => void

  achievements: Achievement[]

  getBanco: () => ReturnType<typeof bancoDeQuestoes>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (t) => set({ theme: t }),

      onboardingConcluido: false,
      onboarding: { concursoId: 'cra-rj-2026', cargoId: '101', dataProva: '2026-10-18', horasPorDia: 2 },
      concluirOnboarding: (data) => {
        const banco = bancoDeQuestoes(data.cargoId)
        const historico = gerarHistoricoSeed(banco)
        set({ onboarding: data, onboardingConcluido: true, attempts: historico })
      },

      attempts: [],
      registrarResposta: (attempt) => set((s) => ({ attempts: [...s.attempts, attempt] })),
      definirMotivoErro: (attemptId, motivo) =>
        set((s) => ({ attempts: s.attempts.map((a) => (a.id === attemptId ? { ...a, motivoErro: motivo } : a)) })),
      marcarRevisado: (attemptId) =>
        set((s) => ({ attempts: s.attempts.map((a) => (a.id === attemptId ? { ...a, revisado: true } : a)) })),

      simulados: [],
      criarSimulado: (sim) => set((s) => ({ simulados: [...s.simulados, sim] })),
      finalizarSimulado: (id, respostas) =>
        set((s) => ({
          simulados: s.simulados.map((sim) =>
            sim.id === id ? { ...sim, respostas, concluidoEm: new Date().toISOString() } : sim,
          ),
        })),

      favoritos: [],
      toggleFavorito: (questionId) =>
        set((s) => ({
          favoritos: s.favoritos.includes(questionId)
            ? s.favoritos.filter((id) => id !== questionId)
            : [...s.favoritos, questionId],
        })),

      plano: null,
      definirPlano: (p) => set({ plano: p }),

      achievements: achievementsBase,

      getBanco: () => bancoDeQuestoes(get().onboarding.cargoId),
    }),
    { name: 'aprova-ai-store' },
  ),
)
