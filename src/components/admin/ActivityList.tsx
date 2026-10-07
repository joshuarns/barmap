import { Link } from 'react-router-dom'
import { Check, Eye, MessageSquareWarning, Pencil, Plus, Power, ShieldOff, Trash2, X, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { ACTION_LABELS, ENTITY_LABELS, FIELD_LABELS, logLink } from '@/features/admin/labels'
import type { LogEntry } from '@/features/admin/platform'
import { cn } from '@/lib/cn'

const ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  approve: { icon: Check, cls: 'bg-success-50 text-success-700' },
  reject: { icon: X, cls: 'bg-danger-50 text-danger-700' },
  request_changes: { icon: MessageSquareWarning, cls: 'bg-warning-50 text-warning-700' },
  suspend: { icon: ShieldOff, cls: 'bg-ink-900 text-white' },
  reactivate: { icon: Power, cls: 'bg-info-50 text-info-700' },
  edit: { icon: Pencil, cls: 'bg-ink-100 text-ink-700' },
  create: { icon: Plus, cls: 'bg-ink-100 text-ink-700' },
  delete: { icon: Trash2, cls: 'bg-danger-50 text-danger-700' },
}

const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

export function ActivityList({ items, compact }: { items: LogEntry[]; compact?: boolean }) {
  return (
    <ol className="divide-y divide-line">
      {items.map((l) => {
        const meta = ICON[l.action] ?? { icon: Eye, cls: 'bg-ink-100 text-ink-700' }
        const Icon = meta.icon
        const href = logLink(l)
        const label = l.entityLabel ?? (l.metadata?.name as string | undefined) ?? '(eliminado)'
        return (
          <li key={l.id} className="flex gap-3 py-3.5">
            <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', meta.cls)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-[15px]">
              <p>
                <span className="font-semibold">{l.adminName}</span> {ACTION_LABELS[l.action] ?? l.action}{' '}
                <span className="text-fg-muted">{ENTITY_LABELS[l.entityType].toLowerCase()}</span>{' '}
                {href ? <Link to={href} className="font-semibold hover:underline">{label}</Link> : <span className="font-semibold">{label}</span>}
              </p>
              {l.comment && !compact && <p className="mt-0.5 line-clamp-2 text-sm text-ink-600">“{l.comment}”</p>}
              {!compact && Array.isArray(l.metadata?.changedFields) && (
                <p className="mt-0.5 text-xs text-fg-subtle">Campos: {(l.metadata.changedFields as string[]).filter((f) => f !== 'longitude').map((f) => (f === 'latitude' ? 'Ubicación' : FIELD_LABELS[f] ?? f)).join(', ')}</p>
              )}
              <p className="mt-0.5 text-xs text-fg-subtle">{dateTime.format(new Date(l.createdAt))}</p>
            </div>
            {!compact && <Avatar name={l.adminName} size="sm" className="hidden sm:inline-flex" />}
          </li>
        )
      })}
    </ol>
  )
}
