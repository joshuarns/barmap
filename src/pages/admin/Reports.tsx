import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ExternalLink, Flag, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { Badge, Button, Card, EmptyState, Field, Modal, Pagination, PublicationStatusBadge, Skeleton, Tabs, Textarea, buttonVariants, useToast } from '@/components/ui'
import { REPORT_REASONS, useAdminReports, useResolveReport, type AdminReport } from '@/features/engagement'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

type Status = AdminReport['status']
const STATUS_LABEL: Record<Status, { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  open: { label: 'Abierto', tone: 'warning' },
  resolved: { label: 'Atendido', tone: 'success' },
  dismissed: { label: 'Descartado', tone: 'neutral' },
}

export default function Reports() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as Status | null) ?? 'open'
  const page = Number(params.get('page')) || 1
  const list = useAdminReports({ status, page })
  const resolve = useResolveReport()
  const toast = useToast()
  const [target, setTarget] = useState<{ report: AdminReport; action: 'resolve' | 'dismiss' } | null>(null)
  const [note, setNote] = useState('')
  useDocumentMeta({ title: 'Reportes' })

  const c = list.data?.counts ?? {}
  const run = () =>
    resolve.mutate(
      { id: target!.report.id, action: target!.action, note: note.trim() || undefined },
      {
        onSuccess: () => { toast({ tone: 'success', title: target!.action === 'resolve' ? 'Reporte atendido' : 'Reporte descartado' }); setTarget(null) },
        onError: (e) => toast({ tone: 'error', title: 'No se pudo actualizar', description: e.message }),
      },
    )

  return (
    <>
      <PageHeader title="Reportes de usuarios" description="Información incorrecta, cierres y contenido inapropiado reportados por el público." />
      <Tabs
        className="mb-5"
        value={status}
        onChange={(v) => setParams(v === 'open' ? {} : { estado: v }, { replace: true })}
        tabs={[
          { value: 'open', label: 'Abiertos', count: c.open ?? 0 },
          { value: 'resolved', label: 'Atendidos', count: c.resolved ?? 0 },
          { value: 'dismissed', label: 'Descartados', count: c.dismissed ?? 0 },
        ]}
      />
      {list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => list.refetch()} /></Card>
      ) : !list.data ? (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : list.data.items.length === 0 ? (
        <Card><EmptyState icon={Flag} title={status === 'open' ? 'Sin reportes pendientes' : 'Nada por aquí'} description={status === 'open' ? 'Cuando alguien reporte un problema aparecerá aquí.' : undefined} /></Card>
      ) : (
        <ul className={cn('space-y-3', list.isPlaceholderData && 'opacity-60')}>
          {list.data.items.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/moderacion/${r.barId}`} className="font-bold hover:underline">{r.barName}</Link>
                      <PublicationStatusBadge status={r.barStatus} />
                      <Badge tone={STATUS_LABEL[r.status].tone} dot>{STATUS_LABEL[r.status].label}</Badge>
                      {r.status === 'open' && r.openForBar > 1 && <Badge tone="danger">{r.openForBar} reportes abiertos de este bar</Badge>}
                    </div>
                    <p className="mt-1 font-medium">{REPORT_REASONS[r.reason]}</p>
                    {r.details && <p className="mt-1 whitespace-pre-line text-[15px] text-ink-600">“{r.details}”</p>}
                    <p className="mt-2 text-sm text-fg-muted">
                      {r.reporterName ? `Por ${r.reporterName}` : 'Anónimo'} · {formatDate(r.createdAt)}{r.city && ` · ${r.city}`}
                    </p>
                    {r.status !== 'open' && (
                      <p className="mt-2 text-sm text-fg-muted">
                        {STATUS_LABEL[r.status].label} por {r.resolvedBy} el {formatDate(r.resolvedAt!)}{r.resolutionNote && `: “${r.resolutionNote}”`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.barStatus === 'published' && (
                      <a href={`/bares/${r.barSlug}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver público <ExternalLink /></a>
                    )}
                    {r.status === 'open' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setNote(''); setTarget({ report: r, action: 'dismiss' }) }}><X /> Descartar</Button>
                        <Button variant="dark" size="sm" onClick={() => { setNote(''); setTarget({ report: r, action: 'resolve' }) }}><Check /> Marcar atendido</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination className="mt-8" page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => setParams({ ...(status !== 'open' && { estado: status }), page: String(p) })} />}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={target?.action === 'resolve' ? 'Marcar como atendido' : 'Descartar reporte'}
        description={target?.action === 'resolve'
          ? 'Úsalo cuando ya corregiste la información, pediste cambios o suspendiste la publicación.'
          : 'Úsalo cuando el reporte no procede (spam, información correcta, etc.).'}
        footer={<><Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button><Button variant="dark" onClick={run} loading={resolve.isPending}>Confirmar</Button></>}
      >
        <Field label="Nota interna" optional hint="Queda en el historial de moderación.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        {target && (
          <Link to={`/admin/moderacion/${target.report.barId}`} className="mt-3 inline-block text-sm font-semibold underline-offset-4 hover:underline">
            Revisar el establecimiento (editar, pedir cambios o suspender)
          </Link>
        )}
      </Modal>
    </>
  )
}
