import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useAppStore } from '@/lib/store'
import { Onboarding } from '@/pages/Onboarding'
import { Dashboard } from '@/pages/Dashboard'
import { Simulados } from '@/pages/Simulados'
import { SimuladoRunner } from '@/pages/SimuladoRunner'
import { Resultado } from '@/pages/Resultado'
import { Questao } from '@/pages/Questao'
import { Erros } from '@/pages/Erros'
import { Revisao } from '@/pages/Revisao'
import { Disciplinas } from '@/pages/Disciplinas'
import { Disciplina } from '@/pages/Disciplina'
import { Desempenho } from '@/pages/Desempenho'
import { PlanoEstudos } from '@/pages/PlanoEstudos'
import { Professor } from '@/pages/Professor'
import { Perfil } from '@/pages/Perfil'
import { Configuracoes } from '@/pages/Configuracoes'

function App() {
  const onboardingConcluido = useAppStore((s) => s.onboardingConcluido)

  if (!onboardingConcluido) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/simulados" element={<Simulados />} />
        <Route path="/simulado/:id" element={<SimuladoRunner />} />
        <Route path="/resultados/:id" element={<Resultado />} />
        <Route path="/questao/:id" element={<Questao />} />
        <Route path="/erros" element={<Erros />} />
        <Route path="/revisao" element={<Revisao />} />
        <Route path="/disciplinas" element={<Disciplinas />} />
        <Route path="/disciplina/:id" element={<Disciplina />} />
        <Route path="/desempenho" element={<Desempenho />} />
        <Route path="/plano-estudos" element={<PlanoEstudos />} />
        <Route path="/professor" element={<Professor />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
