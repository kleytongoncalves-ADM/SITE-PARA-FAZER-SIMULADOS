import { useState } from 'react'
import { Sun, Moon, Type, Trash2, Bell } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function Configuracoes() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [fontScale, setFontScale] = useState(100)
  const [notificacoes, setNotificacoes] = useState(true)

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Personalize a experiência da plataforma." />

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-4 pb-10">
        <Card>
          <CardHeader title="Aparência" />
          <CardBody className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Tema</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={cn('flex-1 flex items-center justify-center gap-2 surface-2 rounded-xl py-3 text-sm font-medium', theme === 'light' && 'bg-brand-600 text-white')}
                >
                  <Sun size={16} /> Claro
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={cn('flex-1 flex items-center justify-center gap-2 surface-2 rounded-xl py-3 text-sm font-medium', theme === 'dark' && 'bg-brand-600 text-white')}
                >
                  <Moon size={16} /> Escuro
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Type size={16} /> Tamanho da fonte
              </div>
              <input
                type="range"
                min={90}
                max={130}
                step={5}
                value={fontScale}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setFontScale(v)
                  document.documentElement.style.fontSize = `${v}%`
                }}
                className="w-full accent-brand-500"
              />
              <div className="text-right text-sm font-semibold">{fontScale}%</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notificações e estudo" />
          <CardBody className="flex flex-col gap-4">
            <label className="flex items-center justify-between surface-2 rounded-xl p-3 cursor-pointer">
              <span className="text-sm font-medium flex items-center gap-2">
                <Bell size={16} /> Lembretes de revisão diária
              </span>
              <input type="checkbox" checked={notificacoes} onChange={(e) => setNotificacoes(e.target.checked)} className="w-5 h-5 accent-brand-500" />
            </label>
            <p className="text-xs text-muted">
              Esta é uma demonstração com dados mockados. Em produção, esta seção controlará integrações reais de notificação e backend.
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Dados" subtitle="Gerencie o histórico local de estudo desta demonstração." />
          <CardBody>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => {
                if (confirm('Isso apagará todo o seu progresso de demonstração. Deseja continuar?')) {
                  localStorage.removeItem('aprova-ai-store')
                  window.location.reload()
                }
              }}
            >
              Reiniciar dados de demonstração
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
