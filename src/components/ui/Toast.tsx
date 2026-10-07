import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

const ToastContext = createContext<((t: Omit<ToastItem, 'id'>) => void) | null>(null)

const icons = { success: CheckCircle2, error: XCircle, info: Info }
const iconColor = { success: 'text-success-600', error: 'text-danger-600', info: 'text-info-600' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = Date.now() + Math.random()
      setItems((xs) => [...xs.slice(-2), { ...t, id }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {items.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl bg-ink-900 p-4 text-white shadow-lg"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', iconColor[t.tone], 'brightness-150')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-ink-300">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="-m-1 flex size-7 items-center justify-center rounded-full text-ink-300 hover:bg-white/10 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
