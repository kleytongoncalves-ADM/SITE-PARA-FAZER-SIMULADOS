import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  RefreshCcw,
  BookOpen,
  BarChart3,
  CalendarClock,
  GraduationCap,
  User,
  Settings,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/simulados', label: 'Simulados', icon: FileText },
  { to: '/erros', label: 'Meus Erros', icon: AlertTriangle },
  { to: '/revisao', label: 'Revisão', icon: RefreshCcw },
  { to: '/disciplinas', label: 'Disciplinas', icon: BookOpen },
  { to: '/desempenho', label: 'Desempenho', icon: BarChart3 },
  { to: '/plano-estudos', label: 'Meu Plano', icon: CalendarClock },
  { to: '/professor', label: 'Meu Professor', icon: GraduationCap },
]

const bottomNavItems = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/simulados', label: 'Simulados', icon: FileText },
  { to: '/erros', label: 'Erros', icon: AlertTriangle },
  { to: '/desempenho', label: 'Métricas', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil', icon: User },
]

export function AppShell({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  return (
    <div className={cn(theme === 'dark' && 'dark')}>
      <div className="min-h-dvh flex" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          <div className="h-16 flex items-center gap-2 px-5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">APROVA.AI</span>
          </div>
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-muted hover:bg-[var(--surface-2)]',
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-muted hover:bg-[var(--surface-2)]',
                )
              }
            >
              <User size={18} />
              Perfil
            </NavLink>
            <NavLink
              to="/configuracoes"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-muted hover:bg-[var(--surface-2)]',
                )
              }
            >
              <Settings size={18} />
              Configurações
            </NavLink>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 surface p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-bold text-lg">APROVA.AI</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
                  <X size={22} />
                </button>
              </div>
              {[...navItems, { to: '/perfil', label: 'Perfil', icon: User }, { to: '/configuracoes', label: 'Configurações', icon: Settings }].map(
                (item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                        isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-muted hover:bg-[var(--surface-2)]',
                      )
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ),
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header
            className="h-16 shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b sticky top-0 z-30"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu size={22} />
            </button>
            <form
              className="flex-1 max-w-md"
              onSubmit={(e) => {
                e.preventDefault()
                if (query.trim()) navigate(`/disciplinas?busca=${encodeURIComponent(query)}`)
              }}
            >
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar assunto, questão ou disciplina..."
                  className="w-full surface-2 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                  aria-label="Busca global"
                />
              </div>
            </form>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl surface flex items-center justify-center hover:bg-[var(--surface-2)]"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </header>

          <main className="flex-1 min-w-0 pb-24 lg:pb-8">{children}</main>
        </div>

        {/* Bottom nav mobile */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t flex items-stretch"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium',
                  isActive ? 'text-brand-500' : 'text-muted',
                )
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
