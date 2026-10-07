import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { Alert, Button, Card, Field, PublicationStatusBadge, Skeleton, Textarea, useToast } from '@/components/ui'
import { useCatalog } from '@/features/bars/queries'
import { useAdminEditBar, useReview, type ReviewDetail } from '@/features/admin/platform'
import { StepGeneral } from '@/features/owner/steps/StepGeneral'
import { StepLocation } from '@/features/owner/steps/StepLocation'
import { StepDetails } from '@/features/owner/steps/StepDetails'
import type { BarFields } from '@/features/owner/bars'
import { ApiError } from '@/lib/api'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import type { Catalog } from '@/types/api'

/**
 * Edición directa por el admin (correcciones de datos). Se aplica a la
 * versión vigente, queda en la auditoría con los campos cambiados y se
 * notifica al propietario. Las fotos las gestiona el propietario.
 */
export default function BarAdminEdit() {
  const { id = '' } = useParams()
  const review = useReview(id)
  const catalog = useCatalog()
  useDocumentMeta({ title: 'Editar establecimiento' })
  if (review.isError) return <Card><ErrorState error={review.error} onRetry={() => review.refetch()} /></Card>
  if (!review.data || !catalog.data) return <Skeleton className="h-[600px] rounded-2xl" />
  return <EditForm r={review.data} catalog={catalog.data} />
}

function EditForm({ r, catalog }: { r: ReviewDetail; catalog: Catalog }) {
  const [form, setForm] = useState<BarFields>(r.data)
  const [comment, setComment] = useState('')
  const save = useAdminEditBar(r.bar.id)
  const toast = useToast()
  const navigate = useNavigate()
  const set = useCallback(<K extends keyof BarFields>(k: K, v: BarFields[K]) => setForm((f) => ({ ...f, [k]: v })), [])
  const patch = useCallback((p: Partial<BarFields>) => setForm((f) => ({ ...f, ...p })), [])
  const errors = save.error instanceof ApiError && save.error.details ? Object.fromEntries(Object.entries(save.error.details).map(([k, v]) => [k.replace(/^data\./, ''), v[0]])) : {}
  const props = { form, set, patch, errors, catalog }

  const submit = () =>
    save.mutate(
      { data: form, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Cambios guardados', description: 'Notificamos al propietario.' })
          navigate(`/admin/moderacion/${r.bar.id}`)
        },
        onError: (e) => toast({ tone: 'error', title: 'No se pudo guardar', description: e.message }),
      },
    )

  return (
    <div className="pb-24">
      <Link to={`/admin/moderacion/${r.bar.id}`} className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Volver
      </Link>
      <PageHeader title={`Editar «${r.data.name}»`} actions={<PublicationStatusBadge status={r.bar.status} size="md" />} />
      <Alert tone="info" className="mb-6" title="Edición administrativa">
        Los cambios se aplican directamente a la versión vigente{r.bar.status === 'published' ? ' (visible al público)' : ''}, quedan en el historial y se notifican al propietario.
        {r.revision?.status === 'pending_review' && ' Hay cambios del propietario en revisión: después de esta edición quedarán desactualizados.'}
      </Alert>
      <div className="space-y-6">
        <Card className="p-5 md:p-8"><h2 className="mb-6 text-xl font-bold">Información general</h2><StepGeneral {...props} /></Card>
        <Card className="p-5 md:p-8"><h2 className="mb-6 text-xl font-bold">Ubicación</h2><StepLocation {...props} /></Card>
        <Card className="p-5 md:p-8"><h2 className="mb-6 text-xl font-bold">Detalles</h2><StepDetails {...props} /></Card>
        <Card className="p-5 md:p-8">
          <Field label="Motivo de la edición" optional hint="El propietario lo verá en su notificación.">
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Ej. Corregimos el teléfono según reporte de usuarios." />
          </Field>
        </Card>
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:left-[272px]">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 md:px-8">
          <Link to={`/admin/moderacion/${r.bar.id}`} className="text-sm font-semibold text-fg-muted hover:text-fg">Cancelar</Link>
          <Button onClick={submit} loading={save.isPending}><Save /> Guardar cambios</Button>
        </div>
      </div>
    </div>
  )
}
