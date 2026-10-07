import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useMarkNotificationsRead, useNotifications, type Notification } from '@/features/engagement'
import { cn } from '@/lib/cn'

const relative = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return relative.format(-mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}

/** Campana con las respuestas del equipo (aprobaciones, cambios, suspensiones…). */
export function NotificationBell({ tone = 'light', align = 'right' }: { tone?: 'light' | 'dark'; align?: 'left' | 'right' }) {
  const q = useNotifications()
  const mark = useMarkNotificationsRead()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = q.data?.unread ?? 0

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const go = (n: Notification) => {
    if (!n.readAt) mark.mutate([n.id])
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        className={cn('relative flex size-10 items-center justify-center rounded-full transition-colors', tone === 'dark' ? 'text-ink-300 hover:bg-white/10 hover:text-white' : 'text-fg hover:bg-ink-50')}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-canvas">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={cn('absolute z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface text-fg shadow-lg', align === 'right' ? 'right-0' : 'left-0')}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            {unread > 0 && (
              <button type="button" onClick={() => mark.mutate(undefined)} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
                <CheckCheck className="size-4" /> Marcar todo como leído
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {!q.data?.items.length ? (
              <li className="px-4 py-8 text-center text-sm text-fg-muted">No tienes notificaciones.</li>
            ) : (
              q.data.items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => go(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-subtle', !n.readAt && 'bg-brand-50/50')}>
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-600')} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{n.title}</span>
                      {n.body && <span className="line-clamp-2 block text-sm text-fg-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-fg-subtle">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
