import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Eye, MessageSquareWarning, Plus, Store, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { LogoMark } from '@/components/brand/Logo'
import { Badge, Button, Card, EmptyState, Modal, PublicationStatusBadge, Skeleton, Tabs, buttonVariants, useToast } from '@/components/ui'
import { useSession } from '@/features/auth/session'
import { useDeleteBar, useOwnerBars, type OwnerBarRow } from '@/features/owner/bars'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { formatDate, formatNumber } from '@/lib/format'

type Filter = 'all' | 'action' | 'review' | 'published' | 'draft'

const needsAction = (b: OwnerBarRow) => b.status === 'changes_requested' || b.status === 'rejected' || b.revisionStatus === 'changes_requested'
const inReview = (b: OwnerBarRow) => b.status === 'pending_review' || b.revisionStatus === 'pending_review'

export default function MyBars() {
  const bars = useOwnerBars()
  const { user } = useSession()
  const [filter, setFilter] = useState<Filter>('all')
  const [toDelete, setToDelete] = useState<OwnerBarRow | null>(null)
  const del = useDeleteBar()
  const toast = useToast()
  const suspended = user?.accountStatus === 'suspended'
  useDocumentMeta({ title: 'Mis establecimientos' })

  const items = bars.data ?? []
  const filtered = items.filter((b) =>
    filter === 'all' ? true : filter === 'action' ? needsAction(b) : filter === 'review' ? inReview(b) : b.status === filter,
  )

  return (
    <>
      <PageHeader
        title="Mis establecimientos"
        description="Crea, edita y envía tus bares a revisión. Solo los aprobados aparecen en Barmap."
        actions={!suspended && <Link to="/panel/establecimientos/nuevo" className={buttonVariants()}><Plus /> Agregar establecimiento</Link>}
      />

      {bars.isError ? (
        <Card><ErrorState error={bars.error} onRetry={() => bars.refetch()} /></Card>
      ) : bars.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="Aún no tienes establecimientos"
            description="Registra tu primer bar en 5 pasos. Puedes guardar el borrador y continuar cuando quieras."
            action={!suspended && <Link to="/panel/establecimientos/nuevo" className={buttonVariants()}><Plus /> Agregar mi primer bar</Link>}
          />
        </Card>
      ) : (
        <>
          <Tabs
            className="mb-5"
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'all', label: 'Todos', count: items.length },
              { value: 'action', label: 'Requieren acción', count: items.filter(needsAction).length },
              { value: 'review', label: 'En revisión', count: items.filter(inReview).length },
              { value: 'published', label: 'Publicados', count: items.filter((b) => b.status === 'published').length },
              { value: 'draft', label: 'Borradores', count: items.filter((b) => b.status === 'draft').length },
            ]}
          />
          {filtered.length === 0 ? (
            <Card><EmptyState icon={Store} title="Nada por aquí" description="No hay establecimientos en este filtro." /></Card>
          ) : (
            <ul className="space-y-3">
              {filtered.map((b) => <BarRow key={b.id} bar={b} onDelete={() => setToDelete(b)} readOnly={suspended} />)}
            </ul>
          )}
        </>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`¿Eliminar «${toDelete?.name}»?`}
        description="Se borrará el borrador y sus fotos. Esta acción no se puede deshacer."
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() =>
                del.mutate(toDelete!.id, {
                  onSuccess: () => {
                    toast({ tone: 'success', title: 'Borrador eliminado' })
                    setToDelete(null)
                  },
                  onError: (e) => toast({ tone: 'error', title: 'No se pudo eliminar', description: e.message }),
                })
              }
            >
              Eliminar
            </Button>
          </>
        }
      />
    </>
  )
}

function BarRow({ bar, onDelete, readOnly }: { bar: OwnerBarRow; onDelete: () => void; readOnly?: boolean }) {
  const note = bar.revisionStatus === 'changes_requested' ? bar.revisionComment : bar.status === 'changes_requested' || bar.status === 'rejected' ? bar.moderationNote : null
  const deletable = !bar.publishedAt && (bar.status === 'draft' || bar.status === 'rejected' || bar.status === 'changes_requested')
  const cta = readOnly || inReview(bar) ? 'Ver' : bar.status === 'draft' ? 'Continuar' : needsAction(bar) ? 'Corregir' : 'Editar'

  return (
    <li>
      <Card className="relative flex flex-col gap-4 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-100 text-ink-300">
            {bar.coverUrl ? <img src={bar.coverUrl} alt="" className="h-full w-full object-cover" /> : <LogoMark className="size-8" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/panel/establecimientos/${bar.id}`} className="truncate font-bold after:absolute after:inset-0 hover:underline">{bar.name}</Link>
              <PublicationStatusBadge status={bar.status} />
              {bar.revisionStatus === 'pending_review' && <Badge tone="info" dot>Cambios en revisión</Badge>}
              {bar.revisionStatus === 'draft' && <Badge dot>Cambios sin enviar</Badge>}
              {bar.revisionStatus === 'changes_requested' && <Badge tone="warning" dot>Ajustes solicitados</Badge>}
            </div>
            <p className="mt-0.5 truncate text-sm text-fg-muted">
              {[bar.category, bar.neighborhood ?? bar.city].filter(Boolean).join(' · ') || 'Sin completar'} · actualizado el {formatDate(bar.updatedAt)}
            </p>
            {bar.status === 'published' && <p className="mt-1 text-sm text-fg-muted"><Eye className="mr-1 inline size-3.5" />{formatNumber(bar.views30d)} visitas en 30 días</p>}
            {note && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-warning-700">
                <MessageSquareWarning className="mt-0.5 size-4 shrink-0" /> <span className="line-clamp-2">{note}</span>
              </p>
            )}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2 sm:ml-auto">
          {deletable && !readOnly && (
            <Button variant="ghost" size="icon" aria-label={`Eliminar ${bar.name}`} onClick={onDelete}><Trash2 /></Button>
          )}
          {bar.status === 'published' && (
            <a href={`/bares/${bar.slug}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Ver público</a>
          )}
          <Link to={`/panel/establecimientos/${bar.id}`} className={buttonVariants({ variant: needsAction(bar) ? 'primary' : 'dark', size: 'sm' })}>
            {cta} <ChevronRight className="size-4" />
          </Link>
        </div>
      </Card>
    </li>
  )
}
