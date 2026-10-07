import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Eye, Heart, Navigation, Share2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/dashboard/StatCard'
import { AreaChart } from '@/components/charts/AreaChart'
import { ErrorState } from '@/components/ErrorState'
import { Card, CardBody, EmptyState, PublicationStatusBadge, SegmentedControl, Skeleton, buttonVariants } from '@/components/ui'
import { useOwnerStats, type StatsPoint } from '@/features/engagement'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

type Metric = 'views' | 'directions' | 'shares' | 'favorites'
const METRICS: Record<Metric, string> = { views: 'Visitas', directions: 'Cómo llegar', shares: 'Compartidos', favorites: 'Guardados' }

export default function Stats() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const [metric, setMetric] = useState<Metric>('views')
  const stats = useOwnerStats(Number(days))
  useDocumentMeta({ title: 'Estadísticas' })
  const d = stats.data
  const total = (m: Metric) => d?.series.reduce((a, p: StatsPoint) => a + p[m], 0) ?? 0

  return (
    <>
      <PageHeader title="Estadísticas" description="Cómo interactúa la gente con tus establecimientos publicados." />

      {/* Filtros: una fila, arriba de todo lo que afectan */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Periodo"
          value={days}
          onChange={setDays}
          options={[{ value: '7', label: '7 días' }, { value: '30', label: '30 días' }, { value: '90', label: '90 días' }]}
        />
      </div>

      {stats.isError ? (
        <Card><ErrorState error={stats.error} onRetry={() => stats.refetch()} /></Card>
      ) : !d ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : d.bars.length === 0 ? (
        <Card>
          <EmptyState icon={BarChart3} title="Aún no hay datos" description="Cuando publiques un establecimiento verás aquí sus visitas." action={<Link to="/panel/establecimientos/nuevo" className={buttonVariants()}>Agregar establecimiento</Link>} />
        </Card>
      ) : (
        <div className={cn('space-y-6 transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Visitas" value={total('views')} icon={Eye} tone="brand" />
            <StatCard label="Cómo llegar" value={total('directions')} icon={Navigation} />
            <StatCard label="Compartidos" value={total('shares')} icon={Share2} />
            <StatCard label="Guardados" value={total('favorites')} icon={Heart} />
          </div>

          <Card>
            <CardBody>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-sans text-base font-bold tracking-normal">{METRICS[metric]} por día</h2>
                <SegmentedControl label="Métrica" value={metric} onChange={setMetric} options={(Object.keys(METRICS) as Metric[]).map((m) => ({ value: m, label: METRICS[m] }))} className="scrollbar-none max-w-full overflow-x-auto" />
              </div>
              <AreaChart data={d.series.map((p) => ({ x: p.day, y: p[metric] }))} label={METRICS[metric]} />
              <p className="mt-2 text-xs text-fg-subtle">Contamos una vez por persona y día. Pasa el cursor o usa ← → sobre la gráfica para ver cada día.</p>
            </CardBody>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <caption className="px-5 pb-1 pt-5 text-left font-sans text-base font-bold">Por establecimiento · últimos {days} días</caption>
              <thead className="border-b border-line text-xs font-bold uppercase tracking-[0.06em] text-fg-subtle">
                <tr>
                  <th className="px-5 py-3">Establecimiento</th>
                  <th className="px-5 py-3 text-right">Visitas</th>
                  <th className="px-5 py-3 text-right">Cómo llegar</th>
                  <th className="px-5 py-3 text-right">Compartidos</th>
                  <th className="px-5 py-3 text-right">Guardado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.bars.map((b) => (
                  <tr key={b.id} className="hover:bg-subtle">
                    <td className="px-5 py-3">
                      <Link to={`/panel/establecimientos/${b.id}`} className="font-semibold hover:underline">{b.name}</Link>
                      {b.status !== 'published' && <span className="ml-2"><PublicationStatusBadge status={b.status} /></span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatNumber(b.views)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatNumber(b.directions)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatNumber(b.shares)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatNumber(b.savedBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  )
}
