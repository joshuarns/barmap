import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ClipboardCheck, Flag, ShieldOff, UserCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActivityList } from '@/components/admin/ActivityList'
import { ErrorState } from '@/components/ErrorState'
import { Badge, Card, CardBody, EmptyState, Skeleton, buttonVariants } from '@/components/ui'
import { useAdminOverview, useModerationQueue } from '@/features/admin/platform'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { formatDate, formatNumber } from '@/lib/format'

export default function Overview() {
  const o = useAdminOverview()
  const queue = useModerationQueue({ page: 1 })
  useDocumentMeta({ title: 'Administración' })

  if (o.isError) return <Card><ErrorState error={o.error} onRetry={() => o.refetch()} /></Card>
  const d = o.data

  return (
    <>
      <PageHeader title="Resumen" description="Lo que necesita tu atención y el estado general de Barmap." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {!d ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <Link to="/admin/solicitudes" className="rounded-2xl transition-shadow hover:shadow-md">
              <StatCard label="Solicitudes pendientes" value={d.pendingApplications} icon={UserCheck} tone={d.pendingApplications ? 'warning' : 'neutral'} />
            </Link>
            <Link to="/admin/moderacion" className="rounded-2xl transition-shadow hover:shadow-md">
              <StatCard label="Publicaciones por revisar" value={d.pendingReviews} icon={ClipboardCheck} tone={d.pendingReviews ? 'info' : 'neutral'} />
            </Link>
            <StatCard label="Bares publicados" value={d.published} icon={Building2} tone="success" hint={`${formatNumber(d.bars)} registrados`} />
            <Link to="/admin/establecimientos?estado=suspended" className="rounded-2xl transition-shadow hover:shadow-md">
              <StatCard label="Bares suspendidos" value={d.suspended} icon={ShieldOff} />
            </Link>
            <Link to="/admin/usuarios?rol=owner" className="rounded-2xl transition-shadow hover:shadow-md">
              <StatCard label="Propietarios" value={d.owners} icon={Users} hint={`${formatNumber(d.visitors)} usuarios · ${d.suspendedUsers} suspendidos`} />
            </Link>
            <Link to="/admin/reportes" className="rounded-2xl transition-shadow hover:shadow-md">
              <StatCard label="Reportes abiertos" value={d.openReports} icon={Flag} tone={d.openReports ? 'warning' : 'neutral'} hint={`${formatNumber(d.views30d)} visitas en 30 días`} />
            </Link>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-base font-bold tracking-normal">Por revisar</h2>
              <Link to="/admin/moderacion" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline">Ver cola <ArrowRight className="size-3.5" /></Link>
            </div>
            {!queue.data ? (
              <Skeleton className="mt-4 h-40" />
            ) : queue.data.items.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Cola al día" description="No hay publicaciones esperando revisión." className="py-8" />
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {queue.data.items.slice(0, 5).map((q) => (
                  <li key={`${q.kind}-${q.barId}`}>
                    <Link to={`/admin/moderacion/${q.barId}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-ink-100">{q.coverUrl && <img src={q.coverUrl} alt="" className="h-full w-full object-cover" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{q.name}</span>
                        <span className="block truncate text-sm text-fg-muted">{q.ownerName} · {q.submittedAt ? formatDate(q.submittedAt) : '—'}</span>
                      </span>
                      <Badge tone={q.kind === 'new' ? 'info' : 'brand'}>{q.kind === 'new' ? 'Nuevo' : 'Cambios'}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-base font-bold tracking-normal">Actividad reciente</h2>
              <Link to="/admin/historial" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline">Historial <ArrowRight className="size-3.5" /></Link>
            </div>
            {!d ? <Skeleton className="mt-4 h-40" /> : d.recent.length ? <ActivityList items={d.recent} compact /> : (
              <p className="mt-4 text-[15px] text-fg-muted">Aún no hay acciones registradas.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {d && d.pendingApplications > 0 && (
        <div className="mt-6">
          <Link to="/admin/solicitudes" className={buttonVariants({ variant: 'outline' })}>Revisar {d.pendingApplications} solicitud{d.pendingApplications === 1 ? '' : 'es'} de propietario <ArrowRight /></Link>
        </div>
      )}
    </>
  )
}
