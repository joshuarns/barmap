import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Inbox, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { AccountStatusBadge, ApplicationStatusBadge, Avatar, Card, EmptyState, Input, Pagination, Skeleton, Tabs, buttonVariants } from '@/components/ui'
import { useApplications } from '@/features/admin/applications'
import { useDebounced } from '@/hooks/useDebounced'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import type { ApplicationStatus } from '@/types/domain'

type TabValue = ApplicationStatus | 'all'

export default function Applications() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('estado') as TabValue) || 'pending'
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState(params.get('q') ?? '')
  const debouncedQ = useDebounced(q.trim())
  useDocumentMeta({ title: 'Solicitudes de propietarios' })

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: true })
  }
  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) update({ q: debouncedQ || undefined, page: undefined })
    // Solo reacciona al texto ya estabilizado.
  }, [debouncedQ])

  const list = useApplications({ status: tab === 'all' ? undefined : tab, q: debouncedQ || undefined, page })
  const counts = list.data?.counts ?? {}
  const total = (counts.pending ?? 0) + (counts.approved ?? 0) + (counts.rejected ?? 0)

  return (
    <>
      <PageHeader title="Solicitudes de propietarios" description="Revisa quién pide acceso para publicar establecimientos. Solo las cuentas aprobadas pueden registrar bares." />

      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <Tabs
          value={tab}
          onChange={(v) => update({ estado: v === 'pending' ? undefined : v, page: undefined })}
          tabs={[
            { value: 'pending', label: 'Pendientes', count: counts.pending ?? 0 },
            { value: 'approved', label: 'Aprobadas', count: counts.approved ?? 0 },
            { value: 'rejected', label: 'Rechazadas', count: counts.rejected ?? 0 },
            { value: 'all', label: 'Todas', count: total },
          ]}
          className="md:flex-1"
        />
        <div className="md:w-72">
          <Input leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, correo o negocio" aria-label="Buscar solicitudes" className="h-11" />
        </div>
      </div>

      {list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => list.refetch()} /></Card>
      ) : list.data && list.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={debouncedQ ? 'Sin coincidencias' : tab === 'pending' ? 'Bandeja al día' : 'No hay solicitudes aquí'}
            description={debouncedQ ? 'Prueba con otro nombre o correo.' : tab === 'pending' ? 'No hay solicitudes esperando revisión.' : undefined}
          />
        </Card>
      ) : (
        <Card className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-line bg-subtle text-xs font-bold uppercase tracking-[0.06em] text-fg-subtle md:table-header-group">
              <tr>
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Negocio</th>
                <th className="px-5 py-3">Enviada</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!list.data
                ? Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}><td colSpan={5} className="p-5"><Skeleton className="h-10" /></td></tr>
                  ))
                : list.data.items.map((a) => (
                    <tr key={a.id} className="relative block p-4 transition-colors hover:bg-subtle md:table-row md:p-0">
                      <td className="md:px-5 md:py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={a.name} size="sm" />
                          <div className="min-w-0">
                            <Link to={`/admin/solicitudes/${a.id}`} className="font-semibold after:absolute after:inset-0 hover:underline md:after:hidden">{a.name}</Link>
                            <p className="truncate text-sm text-fg-muted">{a.email}</p>
                          </div>
                          <span className="ml-auto md:hidden"><ApplicationStatusBadge status={a.status} /></span>
                        </div>
                      </td>
                      <td className="mt-2 block pl-11 md:mt-0 md:table-cell md:px-5 md:py-4">
                        <span className="font-medium">{a.businessName}</span>
                        {a.city && <span className="text-fg-muted"> · {a.city}</span>}
                        {a.accountStatus === 'suspended' && <span className="ml-2"><AccountStatusBadge status="suspended" /></span>}
                      </td>
                      <td className="block pl-11 text-sm text-fg-muted md:table-cell md:px-5 md:py-4 md:text-[15px]">{formatDate(a.createdAt)}</td>
                      <td className="hidden md:table-cell md:px-5 md:py-4"><ApplicationStatusBadge status={a.status} /></td>
                      <td className="hidden text-right md:table-cell md:px-5 md:py-4">
                        <Link to={`/admin/solicitudes/${a.id}`} className={buttonVariants({ variant: a.status === 'pending' ? 'dark' : 'outline', size: 'sm' })}>
                          {a.status === 'pending' ? 'Revisar' : 'Ver'}
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </Card>
      )}

      {list.data && <Pagination className="mt-8" page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => update({ page: String(p) })} />}
    </>
  )
}
