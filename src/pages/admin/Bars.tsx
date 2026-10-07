import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Store } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { LogoMark } from '@/components/brand/Logo'
import { Badge, Card, EmptyState, Input, Pagination, PublicationStatusBadge, Select, Skeleton, Tabs, buttonVariants } from '@/components/ui'
import { useAdminBars } from '@/features/admin/platform'
import { useDebounced } from '@/hooks/useDebounced'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import type { PublicationStatus } from '@/types/domain'

const SORTS = { updated: 'Última actualización', submitted: 'Fecha de envío', name: 'Nombre', views: 'Visitas (30 días)' }

export default function Bars() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as PublicationStatus | null) ?? undefined
  const sort = (params.get('orden') as keyof typeof SORTS) || 'updated'
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState(params.get('q') ?? '')
  const dq = useDebounced(q.trim())
  const bars = useAdminBars({ status, q: dq || undefined, sort, page })
  useDocumentMeta({ title: 'Establecimientos' })

  const set = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k)
    setParams(n, { replace: true })
  }
  const c = bars.data?.counts ?? {}
  const total = Object.values(c).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <>
      <PageHeader title="Establecimientos" description="Todos los bares registrados, en cualquier estado." />
      <Tabs
        className="mb-4"
        value={status ?? 'all'}
        onChange={(v) => set({ estado: v === 'all' ? undefined : v, page: undefined })}
        tabs={[
          { value: 'all', label: 'Todos', count: total },
          { value: 'published', label: 'Publicados', count: c.published ?? 0 },
          { value: 'pending_review', label: 'En revisión', count: c.pending_review ?? 0 },
          { value: 'changes_requested', label: 'Con cambios', count: c.changes_requested ?? 0 },
          { value: 'draft', label: 'Borradores', count: c.draft ?? 0 },
          { value: 'rejected', label: 'Rechazados', count: c.rejected ?? 0 },
          { value: 'suspended', label: 'Suspendidos', count: c.suspended ?? 0 },
        ]}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1"><Input leading={<Search />} value={q} onChange={(e) => { setQ(e.target.value); set({ page: undefined }) }} placeholder="Bar, ciudad, propietario o correo" aria-label="Buscar" className="h-11" /></div>
        <div className="sm:w-60">
          <Select value={sort} onChange={(e) => set({ orden: e.target.value === 'updated' ? undefined : e.target.value })} className="h-11" aria-label="Ordenar por">
            {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      {bars.isError ? (
        <Card><ErrorState error={bars.error} onRetry={() => bars.refetch()} /></Card>
      ) : bars.data && bars.data.items.length === 0 ? (
        <Card><EmptyState icon={Store} title="Sin resultados" description="No hay establecimientos con estos filtros." /></Card>
      ) : (
        <Card className={cn('overflow-x-auto', bars.isPlaceholderData && 'opacity-60')}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-line bg-subtle text-xs font-bold uppercase tracking-[0.06em] text-fg-subtle md:table-header-group">
              <tr><th className="px-5 py-3">Establecimiento</th><th className="px-5 py-3">Propietario</th><th className="px-5 py-3">Enviado</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Visitas</th><th className="px-5 py-3"><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!bars.data
                ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={6} className="p-4"><Skeleton className="h-12" /></td></tr>)
                : bars.data.items.map((b) => (
                    <tr key={b.id} className="relative block p-4 hover:bg-subtle md:table-row md:p-0">
                      <td className="md:px-5 md:py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100 text-ink-300">
                            {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-full w-full object-cover" /> : <LogoMark className="size-6" />}
                          </span>
                          <div className="min-w-0">
                            <Link to={`/admin/moderacion/${b.id}`} className="font-semibold after:absolute after:inset-0 hover:underline md:after:hidden">{b.name}</Link>
                            <p className="truncate text-sm text-fg-muted">{[b.category, b.neighborhood ?? b.city].filter(Boolean).join(' · ') || '—'}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5 md:hidden"><PublicationStatusBadge status={b.status} />{b.revisionStatus === 'pending_review' && <Badge tone="info">Cambios en revisión</Badge>}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mt-2 block pl-[60px] text-sm md:mt-0 md:table-cell md:px-5 md:py-3 md:text-[15px]">
                        <Link to={`/admin/usuarios/${b.ownerId}`} className="relative z-10 hover:underline">{b.ownerName}</Link>
                        {b.ownerStatus === 'suspended' && <Badge tone="dark" className="ml-2">Suspendido</Badge>}
                      </td>
                      <td className="hidden text-fg-muted md:table-cell md:px-5 md:py-3">{b.submittedAt ? formatDate(b.submittedAt) : '—'}</td>
                      <td className="hidden md:table-cell md:px-5 md:py-3">
                        <div className="flex flex-col items-start gap-1"><PublicationStatusBadge status={b.status} />{b.revisionStatus === 'pending_review' && <Badge tone="info">Cambios en revisión</Badge>}</div>
                      </td>
                      <td className="hidden text-right tabular-nums md:table-cell md:px-5 md:py-3">{formatNumber(b.views30d)}</td>
                      <td className="hidden text-right md:table-cell md:px-5 md:py-3">
                        <Link to={`/admin/moderacion/${b.id}`} className={buttonVariants({ variant: b.status === 'pending_review' || b.revisionStatus === 'pending_review' ? 'dark' : 'outline', size: 'sm' })}>
                          {b.status === 'pending_review' || b.revisionStatus === 'pending_review' ? 'Revisar' : 'Ver'}
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </Card>
      )}
      {bars.data && <Pagination className="mt-8" page={bars.data.page} totalPages={bars.data.totalPages} onChange={(p) => set({ page: String(p) })} />}
    </>
  )
}
