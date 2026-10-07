import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { History as HistoryIcon, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ActivityList } from '@/components/admin/ActivityList'
import { ErrorState } from '@/components/ErrorState'
import { Button, Card, CardBody, EmptyState, Input, Pagination, Select, Skeleton } from '@/components/ui'
import { ACTION_LABELS, ENTITY_LABELS } from '@/features/admin/labels'
import { useAdminLogs } from '@/features/admin/platform'
import { useDebounced } from '@/hooks/useDebounced'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'

export default function History() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const dq = useDebounced(q.trim())
  const f = {
    entityType: params.get('tipo') ?? undefined,
    action: params.get('accion') ?? undefined,
    from: params.get('desde') ?? undefined,
    to: params.get('hasta') ?? undefined,
    page: Number(params.get('page')) || 1,
  }
  const logs = useAdminLogs({ ...f, q: dq || undefined })
  useDocumentMeta({ title: 'Historial de moderación' })

  const set = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k)
    if (!('page' in patch)) n.delete('page')
    setParams(n, { replace: true })
  }
  const filtered = f.entityType || f.action || f.from || f.to || dq

  return (
    <>
      <PageHeader title="Historial de moderación" description="Registro inalterable de cada acción administrativa: quién, qué, cuándo y por qué." />
      <Card className="mb-5">
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_170px_170px]">
          <Input leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, comentario o admin" aria-label="Buscar en el historial" className="h-11" />
          <Select value={f.entityType ?? ''} onChange={(e) => set({ tipo: e.target.value || undefined })} className="h-11" aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={f.action ?? ''} onChange={(e) => set({ accion: e.target.value || undefined })} className="h-11" aria-label="Acción">
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l[0].toUpperCase() + l.slice(1)}</option>)}
          </Select>
          <Input type="date" value={f.from ?? ''} onChange={(e) => set({ desde: e.target.value || undefined })} aria-label="Desde" className="h-11" />
          <Input type="date" value={f.to ?? ''} onChange={(e) => set({ hasta: e.target.value || undefined })} aria-label="Hasta" className="h-11" />
        </CardBody>
      </Card>
      {filtered && <Button variant="link" className="mb-4" onClick={() => { setQ(''); setParams(new URLSearchParams(), { replace: true }) }}>Limpiar filtros</Button>}

      {logs.isError ? (
        <Card><ErrorState error={logs.error} onRetry={() => logs.refetch()} /></Card>
      ) : !logs.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : logs.data.items.length === 0 ? (
        <Card><EmptyState icon={HistoryIcon} title={filtered ? 'Sin resultados' : 'Aún no hay acciones'} description={filtered ? 'Prueba con otros filtros.' : undefined} /></Card>
      ) : (
        <Card className={cn('px-5', logs.isPlaceholderData && 'opacity-60')}>
          <p className="border-b border-line py-3 text-sm text-fg-muted">{logs.data.total} {logs.data.total === 1 ? 'acción' : 'acciones'}</p>
          <ActivityList items={logs.data.items} />
        </Card>
      )}
      {logs.data && <Pagination className="mt-8" page={logs.data.page} totalPages={logs.data.totalPages} onChange={(p) => set({ page: String(p) })} />}
    </>
  )
}
