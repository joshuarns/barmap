import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ClipboardCheck, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { LogoMark } from '@/components/brand/Logo'
import { Badge, Card, EmptyState, Input, Pagination, Skeleton, Tabs, buttonVariants } from '@/components/ui'
import { FIELD_LABELS } from '@/features/admin/labels'
import { useModerationQueue } from '@/features/admin/platform'
import { useDebounced } from '@/hooks/useDebounced'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

type Tab = 'all' | 'new' | 'revision'

export default function Moderation() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tipo') as Tab) || 'all'
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim())
  const queue = useModerationQueue({ kind: tab === 'all' ? undefined : tab, q: dq || undefined, page })
  useDocumentMeta({ title: 'Moderación' })

  const set = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(params)
    for (const [key, v] of Object.entries(patch)) v ? n.set(key, v) : n.delete(key)
    setParams(n, { replace: true })
  }
  const counts = queue.data?.counts

  return (
    <>
      <PageHeader title="Moderación" description="Establecimientos nuevos y cambios a publicaciones existentes, del más antiguo al más reciente." />
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <Tabs
          className="md:flex-1"
          value={tab}
          onChange={(v) => set({ tipo: v === 'all' ? undefined : v, page: undefined })}
          tabs={[
            { value: 'all', label: 'Todo', count: counts ? counts.new + counts.revision : undefined },
            { value: 'new', label: 'Nuevos', count: counts?.new },
            { value: 'revision', label: 'Cambios', count: counts?.revision },
          ]}
        />
        <div className="md:w-72">
          <Input leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bar, propietario o ciudad" aria-label="Buscar" className="h-11" />
        </div>
      </div>

      {queue.isError ? (
        <Card><ErrorState error={queue.error} onRetry={() => queue.refetch()} /></Card>
      ) : !queue.data ? (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : queue.data.items.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title={dq ? 'Sin coincidencias' : 'Cola al día'} description={dq ? 'Prueba con otra búsqueda.' : 'No hay publicaciones esperando revisión.'} /></Card>
      ) : (
        <ul className={cn('space-y-3', queue.isPlaceholderData && 'opacity-60')}>
          {queue.data.items.map((it) => (
            <li key={`${it.kind}-${it.barId}`}>
              <Card className="relative flex flex-col gap-4 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-100 text-ink-300">
                  {it.coverUrl ? <img src={it.coverUrl} alt="" className="h-full w-full object-cover" /> : <LogoMark className="size-8" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/moderacion/${it.barId}`} className="font-bold after:absolute after:inset-0 hover:underline">{it.name}</Link>
                    <Badge tone={it.kind === 'new' ? 'info' : 'brand'} dot>{it.kind === 'new' ? 'Nuevo' : 'Cambios a publicación'}</Badge>
                    {it.duplicateCount > 0 && <Badge tone="warning"><AlertTriangle /> Posible duplicado</Badge>}
                    {it.ownerStatus === 'suspended' && <Badge tone="dark">Propietario suspendido</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-fg-muted">
                    {[it.neighborhood, it.city].filter(Boolean).join(', ') || 'Sin ubicación'} · {it.ownerName} ({it.ownerEmail})
                  </p>
                  {it.changedFields && it.changedFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.changedFields.map((f) => <Badge key={f}>{FIELD_LABELS[f] ?? f}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="relative z-10 flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-sm text-fg-muted">Enviado {it.submittedAt ? formatDate(it.submittedAt) : '—'}</span>
                  <Link to={`/admin/moderacion/${it.barId}`} className={buttonVariants({ variant: 'dark', size: 'sm' })}>Revisar</Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {queue.data && <Pagination className="mt-8" page={queue.data.page} totalPages={queue.data.totalPages} onChange={(p) => set({ page: String(p) })} />}
    </>
  )
}
