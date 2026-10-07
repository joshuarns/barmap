import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BadgeCheck, Check, ChevronLeft, Flag, ExternalLink, History, Mail, MessageSquareWarning, Pencil, Power, ShieldOff, X,
} from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { PriceRange, PRICE_RANGE_LABELS } from '@/components/bars/PriceRange'
import {
  AccountStatusBadge, Alert, Avatar, Badge, Button, Card, CardBody, Chip, Field, Modal, PublicationStatusBadge, Skeleton, Textarea,
  buttonVariants, useToast,
} from '@/components/ui'
import { useCatalog } from '@/features/bars/queries'
import { ACTION_LABELS, FIELD_LABELS } from '@/features/admin/labels'
import { useBarDecision, useBarVerify, useBarVisibility, useReview, type ReviewDetail } from '@/features/admin/platform'
import type { BarFields, WorkingImage } from '@/features/owner/bars'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { formatDate, formatDistance } from '@/lib/format'
import type { Catalog } from '@/types/api'
import { DAY_LABELS, type DayOfWeek } from '@/types/domain'

const LocationMap = lazy(() => import('@/components/map/LocationMap'))

type Decision = 'approve' | 'reject' | 'request_changes'
type ModalKind = Decision | 'suspend' | 'reactivate' | null

const QUICK: Record<'reject' | 'request_changes' | 'suspend', string[]> = {
  request_changes: [
    'Agrega fotos del interior y de la barra; las actuales no muestran el lugar.',
    'La ubicación en el mapa no coincide con la dirección.',
    'Completa los horarios: hay días sin hora de cierre clara.',
    'La descripción debe hablar del establecimiento, no incluir promociones ni precios.',
  ],
  reject: [
    'El establecimiento no corresponde a un bar o lugar de vida nocturna.',
    'No pudimos verificar que el establecimiento exista en esa dirección.',
    'Es un duplicado de un establecimiento ya publicado.',
    'Las fotos no corresponden al establecimiento o tienen derechos de terceros.',
  ],
  suspend: [
    'Recibimos reportes de que el establecimiento cerró de forma permanente.',
    'La información publicada es incorrecta y estamos verificándola.',
    'Incumple las reglas de publicación de Barmap.',
  ],
}

export default function ModerationReview() {
  const { id = '' } = useParams()
  const review = useReview(id)
  const catalog = useCatalog()
  useDocumentMeta({ title: review.data ? `Revisar · ${review.data.data.name}` : 'Revisar establecimiento' })

  return (
    <>
      <Link to="/admin/moderacion" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Moderación
      </Link>
      {review.isError ? (
        <Card><ErrorState error={review.error} onRetry={() => review.refetch()} /></Card>
      ) : !review.data || !catalog.data ? (
        <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-96 rounded-2xl" /></div>
      ) : (
        <ReviewView r={review.data} catalog={catalog.data} />
      )}
    </>
  )
}

function ReviewView({ r, catalog }: { r: ReviewDetail; catalog: Catalog }) {
  const toast = useToast()
  const decide = useBarDecision(r.bar.id)
  const visibility = useBarVisibility(r.bar.id)
  const verify = useBarVerify(r.bar.id)
  const [modal, setModal] = useState<ModalKind>(null)
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)

  const pendingNew = r.bar.status === 'pending_review'
  const pendingRev = r.revision?.status === 'pending_review'
  const target: 'bar' | 'revision' | null = pendingNew ? 'bar' : pendingRev ? 'revision' : null
  const missing = Object.values(r.missing)
  const commentRequired = modal !== null && modal !== 'approve' && modal !== 'reactivate'
  const commentError = touched && commentRequired && comment.trim().length < 10 ? 'Escribe al menos 10 caracteres. El propietario lo verá.' : undefined

  const open = (m: ModalKind) => {
    setComment('')
    setTouched(false)
    setModal(m)
  }

  const run = () => {
    setTouched(true)
    if (commentRequired && comment.trim().length < 10) return
    const onError = (e: Error) => toast({ tone: 'error', title: 'No se pudo completar la acción', description: e.message })
    if (modal === 'suspend' || modal === 'reactivate') {
      visibility.mutate(
        { action: modal, comment: comment.trim() || undefined },
        { onSuccess: () => { setModal(null); toast({ tone: 'success', title: modal === 'suspend' ? 'Publicación suspendida' : 'Publicación reactivada' }) }, onError },
      )
      return
    }
    if (!modal || !target) return
    decide.mutate(
      { target, decision: modal, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setModal(null)
          toast({
            tone: 'success',
            title: modal === 'approve' ? (target === 'bar' ? 'Establecimiento publicado' : 'Cambios publicados') : modal === 'reject' ? 'Rechazado' : 'Cambios solicitados',
            description: 'Notificamos al propietario por correo.',
          })
        },
        onError,
      },
    )
  }

  const shown = pendingRev && r.revision ? r.revision.data : r.data
  return (
    <div className="pb-28 md:pb-0">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold leading-tight md:text-[32px]">{shown.name}</h1>
            <PublicationStatusBadge status={r.bar.status} size="md" />
            {r.revision && <Badge tone={pendingRev ? 'info' : 'neutral'} size="md" dot>{pendingRev ? 'Cambios en revisión' : r.revision.status === 'changes_requested' ? 'Cambios con ajustes pedidos' : 'Cambios en borrador'}</Badge>}
          </div>
          <p className="mt-1 text-[15px] text-fg-muted">
            {[shown.neighborhood, shown.city].filter(Boolean).join(', ') || 'Sin ubicación'} · creado el {formatDate(r.bar.createdAt)}
            {(pendingRev ? r.revision?.submittedAt : r.bar.submittedAt) && ` · enviado el ${formatDate((pendingRev ? r.revision!.submittedAt : r.bar.submittedAt)!)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {(r.bar.status === 'published' || r.bar.status === 'suspended') && r.bar.publishedAt && (
            <a href={`/bares/${r.bar.slug}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver público <ExternalLink /></a>
          )}
          {r.bar.status === 'published' && (
            <Button
              variant={r.bar.verifiedAt ? 'subtle' : 'outline'}
              size="sm"
              loading={verify.isPending}
              onClick={() =>
                verify.mutate({ verified: !r.bar.verifiedAt }, {
                  onSuccess: () => toast({ tone: 'success', title: r.bar.verifiedAt ? 'Insignia retirada' : 'Marcado como verificado' }),
                  onError: (e) => toast({ tone: 'error', title: 'No se pudo actualizar', description: e.message }),
                })
              }
            >
              <BadgeCheck className={r.bar.verifiedAt ? 'text-info-600' : ''} /> {r.bar.verifiedAt ? 'Verificado' : 'Marcar como verificado'}
            </Button>
          )}
          <Link to={`/admin/establecimientos/${r.bar.id}/editar`} className={buttonVariants({ variant: 'outline', size: 'sm' })}><Pencil /> Editar</Link>
        </div>
      </div>

      {/* Avisos */}
      <div className="mb-6 space-y-3">
        {r.bar.openReports > 0 && (
          <Alert tone="warning" title={`${r.bar.openReports} ${r.bar.openReports === 1 ? 'reporte abierto' : 'reportes abiertos'} de usuarios`} action={<Link to="/admin/reportes" className={buttonVariants({ variant: 'dark', size: 'sm' })}><Flag /> Ver reportes</Link>} />
        )}
        {r.owner.accountStatus === 'suspended' && <Alert tone="danger" title="La cuenta del propietario está suspendida">No se puede publicar mientras la suspensión siga activa.</Alert>}
        {r.revision?.outdated && pendingRev && (
          <Alert tone="warning" title="Estos cambios se basan en una versión anterior">La versión publicada cambió después del envío (p. ej. una edición del admin). No se pueden aprobar: pide al propietario que los revise.</Alert>
        )}
        {pendingNew && missing.length > 0 && (
          <Alert tone="warning" title="Falta información obligatoria">{missing.join(' · ')}</Alert>
        )}
        {r.duplicates.length > 0 && (
          <Alert tone="warning" title="Posible duplicado">
            <ul className="mt-1 space-y-1">
              {r.duplicates.map((d) => (
                <li key={d.id}>
                  <Link to={`/admin/moderacion/${d.id}`} className="font-semibold underline-offset-4 hover:underline">{d.name}</Link> ({d.city}) · {d.sameOwner ? 'mismo propietario' : d.ownerName} · <PublicationStatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {!target && r.bar.moderationNote && (r.bar.status === 'changes_requested' || r.bar.status === 'rejected' || r.bar.status === 'suspended') && (
          <Alert tone="info" title="Último comentario al propietario">“{r.bar.moderationNote}”</Alert>
        )}
        {!target && (r.bar.status === 'draft' || r.bar.status === 'changes_requested' || r.bar.status === 'rejected') && (
          <Alert tone="info" title="Esperando al propietario">No hay nada que revisar por ahora: el establecimiento no ha sido enviado.</Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {pendingRev && r.revision ? (
            <>
              <RevisionDiff r={r} catalog={catalog} />
              <PhotoDiff live={r.images} proposed={r.revision.images} added={r.revision.addedImageIds} removed={r.revision.removedImageIds} />
            </>
          ) : (
            <>
              <Photos images={r.images} />
              <Details data={r.data} catalog={catalog} />
            </>
          )}
          <LocationCard data={shown} />
        </div>

        <aside className="space-y-6">
          <OwnerCard r={r} />
          {r.history.length > 0 && (
            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 font-sans text-base font-bold tracking-normal"><History className="size-4" /> Historial</h2>
                <ol className="mt-4 space-y-3 border-l border-line pl-4 text-sm">
                  {r.history.map((h, i) => (
                    <li key={i}>
                      <p><span className="font-semibold">{h.adminName}</span> {ACTION_LABELS[h.action] ?? h.action} {h.entityType === 'bar_revision' ? 'cambios' : 'el establecimiento'}</p>
                      {h.comment && <p className="text-ink-600">“{h.comment}”</p>}
                      <p className="text-xs text-fg-subtle">{formatDate(h.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      {/* Acciones */}
      {(target || r.bar.status === 'published' || r.bar.status === 'suspended') && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:left-[272px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-8">
            {target ? (
              <>
                <span className="mr-auto hidden text-sm text-fg-muted sm:inline">{target === 'bar' ? 'Establecimiento nuevo' : `${r.revision?.changedFields.length ?? 0} campos modificados`}</span>
                <Button variant="ghost" onClick={() => open('reject')}><X /> Rechazar</Button>
                <Button variant="outline" onClick={() => open('request_changes')}><MessageSquareWarning /> Pedir cambios</Button>
                <Button onClick={() => open('approve')} disabled={(target === 'bar' && missing.length > 0) || r.owner.accountStatus === 'suspended' || (target === 'revision' && r.revision?.outdated)}>
                  <Check /> {target === 'bar' ? 'Aprobar y publicar' : 'Aprobar cambios'}
                </Button>
              </>
            ) : r.bar.status === 'published' ? (
              <Button variant="outline" onClick={() => open('suspend')}><ShieldOff /> Suspender publicación</Button>
            ) : (
              <Button onClick={() => open('reactivate')} disabled={r.owner.accountStatus === 'suspended'}><Power /> Reactivar publicación</Button>
            )}
          </div>
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === 'approve' ? (target === 'bar' ? `¿Publicar «${shown.name}»?` : '¿Aprobar y publicar estos cambios?')
          : modal === 'reject' ? '¿Rechazar?'
          : modal === 'request_changes' ? 'Pedir cambios al propietario'
          : modal === 'suspend' ? '¿Suspender la publicación?'
          : '¿Reactivar la publicación?'
        }
        description={
          modal === 'approve' ? (target === 'bar' ? 'Será visible de inmediato en búsquedas, mapa y su página pública.' : 'Reemplazarán la versión pública actual.')
          : modal === 'reject' ? (target === 'bar' ? 'El propietario podrá corregir y enviar de nuevo.' : 'Los cambios se descartan; la versión publicada no se modifica.')
          : modal === 'request_changes' ? 'El propietario recibirá tu comentario y podrá corregir y reenviar.'
          : modal === 'suspend' ? 'Dejará de mostrarse al público hasta que la reactives. El propietario verá el motivo.'
          : 'Volverá a mostrarse al público.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button
              variant={modal === 'reject' || modal === 'suspend' ? 'danger' : modal === 'request_changes' ? 'dark' : 'primary'}
              onClick={run}
              loading={decide.isPending || visibility.isPending}
            >
              {modal === 'approve' ? 'Aprobar' : modal === 'reject' ? 'Rechazar' : modal === 'request_changes' ? 'Enviar comentario' : modal === 'suspend' ? 'Suspender' : 'Reactivar'}
            </Button>
          </>
        }
      >
        {modal && modal !== 'approve' && modal !== 'reactivate' && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK[modal].map((t) => (
                <Chip key={t} selected={comment === t} onClick={() => setComment(t)} className="h-auto whitespace-normal py-2 text-left">{t}</Chip>
              ))}
            </div>
            <Field label="Comentario para el propietario" error={commentError}>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} />
            </Field>
          </>
        )}
        {modal === 'approve' && (
          <Field label="Nota" optional hint="Se guarda en el historial de moderación.">
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} />
          </Field>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------
// Presentación de datos
// ---------------------------------------------------------------------
function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-sans text-base font-bold tracking-normal">{title}</h2>
          {action}
        </div>
        {children}
      </CardBody>
    </Card>
  )
}

function formatField(field: string, d: BarFields, catalog: Catalog): ReactNode {
  switch (field) {
    case 'categoryId': return catalog.categories.find((c) => c.id === d.categoryId)?.name ?? '—'
    case 'typeId': return catalog.types.find((t) => t.id === d.typeId)?.name ?? '—'
    case 'priceRange': return d.priceRange ? <span className="inline-flex items-center gap-2"><PriceRange value={d.priceRange} /> {PRICE_RANGE_LABELS[d.priceRange]}</span> : '—'
    case 'amenityIds': return catalog.amenities.filter((a) => d.amenityIds.includes(a.id)).map((a) => a.name).join(', ') || '—'
    case 'social': return Object.entries(d.social).filter(([, v]) => v).map(([k, v]) => <span key={k} className="block break-all">{k}: {v}</span>)
    case 'hours': return <HoursList hours={d.hours} />
    case 'latitude': case 'longitude': return d.latitude != null ? `${d.latitude?.toFixed(6)}, ${d.longitude?.toFixed(6)}` : '—'
    case 'description': return <span className="whitespace-pre-line">{d.description || '—'}</span>
    default: return String((d as unknown as Record<string, unknown>)[field] ?? '') || '—'
  }
}

function HoursList({ hours }: { hours: BarFields['hours'] }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {hours.map((h) => (
        <li key={h.dayOfWeek} className="flex justify-between gap-3">
          <span>{DAY_LABELS[h.dayOfWeek as DayOfWeek]}</span>
          <span className="tabular-nums text-fg-muted">{h.isClosed ? 'Cerrado' : `${h.opens} – ${h.closes}`}</span>
        </li>
      ))}
    </ul>
  )
}

const DETAIL_FIELDS = ['name', 'categoryId', 'typeId', 'description', 'priceRange', 'phone', 'website', 'social', 'amenityIds', 'hours']

function Details({ data, catalog }: { data: BarFields; catalog: Catalog }) {
  return (
    <SectionCard title="Información">
      <dl className="divide-y divide-line">
        {DETAIL_FIELDS.map((f) => (
          <div key={f} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
            <dt className="text-sm text-fg-muted">{FIELD_LABELS[f]}</dt>
            <dd className="min-w-0 text-[15px]">{formatField(f, data, catalog)}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}

function RevisionDiff({ r, catalog }: { r: ReviewDetail; catalog: Catalog }) {
  const rev = r.revision!
  // Latitud y longitud se muestran juntas como "Ubicación".
  const fields = rev.changedFields.filter((f) => f !== 'imageIds' && f !== 'longitude').map((f) => (f === 'latitude' ? 'latitude' : f))
  const moved =
    rev.changedFields.some((f) => f === 'latitude' || f === 'longitude') && r.data.latitude != null && rev.data.latitude != null
      ? haversine(r.data.latitude, r.data.longitude!, rev.data.latitude, rev.data.longitude!)
      : null
  return (
    <SectionCard title="Cambios propuestos" action={<Badge tone="info">{rev.changedFields.length} {rev.changedFields.length === 1 ? 'campo' : 'campos'}</Badge>}>
      {fields.length === 0 ? (
        <p className="text-[15px] text-fg-muted">Solo cambian las fotos.</p>
      ) : (
        <div className="divide-y divide-line">
          {fields.map((f) => f === 'hours' ? (
            <HoursDiff key={f} before={r.data.hours} after={rev.data.hours} />
          ) : (
            <div key={f} className="py-4 first:pt-0">
              <p className="mb-2 text-sm font-semibold">{f === 'latitude' ? `Ubicación${moved != null ? ` (se mueve ${formatDistance(moved)})` : ''}` : FIELD_LABELS[f] ?? f}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-danger-50/60 p-3 text-[15px]">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-danger-700">Actual</p>
                  <div className="text-ink-700 line-through decoration-danger-600/40">{formatField(f, r.data, catalog)}</div>
                </div>
                <div className="rounded-xl bg-success-50 p-3 text-[15px]">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-success-700">Propuesto</p>
                  <div>{formatField(f, rev.data, catalog)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

/** Solo los días que cambian, en una tabla compacta. */
function HoursDiff({ before, after }: { before: BarFields['hours']; after: BarFields['hours'] }) {
  const fmt = (h?: BarFields['hours'][number]) => (!h || h.isClosed ? 'Cerrado' : `${h.opens} – ${h.closes}`)
  const changed = after.filter((h) => fmt(h) !== fmt(before.find((b) => b.dayOfWeek === h.dayOfWeek)))
  return (
    <div className="py-4 first:pt-0">
      <p className="mb-2 text-sm font-semibold">Horarios <span className="font-normal text-fg-muted">· {changed.length} {changed.length === 1 ? 'día cambia' : 'días cambian'}</span></p>
      <table className="w-full overflow-hidden rounded-xl text-[15px]">
        <thead className="bg-subtle text-left text-xs font-bold uppercase tracking-wider text-fg-subtle">
          <tr><th className="px-3 py-2">Día</th><th className="px-3 py-2 text-danger-700">Actual</th><th className="px-3 py-2 text-success-700">Propuesto</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {changed.map((h) => (
            <tr key={h.dayOfWeek}>
              <td className="px-3 py-2 font-medium">{DAY_LABELS[h.dayOfWeek as DayOfWeek]}</td>
              <td className="px-3 py-2 tabular-nums text-fg-muted line-through decoration-danger-600/40">{fmt(before.find((b) => b.dayOfWeek === h.dayOfWeek))}</td>
              <td className="px-3 py-2 tabular-nums font-semibold text-success-700">{fmt(h)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function Photos({ images }: { images: WorkingImage[] }) {
  return (
    <SectionCard title={`Fotos (${images.length})`}>
      {images.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img, i) => (
            <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-xl bg-ink-100">
              <img src={img.thumbUrl} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover transition group-hover:brightness-90" />
              {i === 0 && <Badge tone="overlay" className="absolute left-2 top-2">Portada</Badge>}
            </a>
          ))}
        </div>
      ) : <p className="text-fg-muted">Sin fotos.</p>}
    </SectionCard>
  )
}

function PhotoDiff({ live, proposed, added, removed }: { live: WorkingImage[]; proposed: WorkingImage[]; added: string[]; removed: string[] }) {
  const orderChanged = !added.length && !removed.length && live.map((i) => i.id).join() !== proposed.map((i) => i.id).join()
  return (
    <SectionCard
      title="Fotos propuestas"
      action={<span className="text-sm text-fg-muted">{added.length} nuevas · {removed.length} quitadas{orderChanged ? ' · nuevo orden' : ''}</span>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {proposed.map((img, i) => (
          <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className={cn('relative overflow-hidden rounded-xl bg-ink-100', added.includes(img.id) && 'ring-2 ring-success-600 ring-offset-2')}>
            <img src={img.thumbUrl} alt={`Foto propuesta ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            <div className="absolute left-2 top-2 flex gap-1">
              {i === 0 && <Badge tone="overlay">Portada</Badge>}
              {added.includes(img.id) && <Badge tone="success">Nueva</Badge>}
            </div>
          </a>
        ))}
      </div>
      {removed.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-danger-700">Se quitarán</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {live.filter((i) => removed.includes(i.id)).map((img) => (
              <img key={img.id} src={img.thumbUrl} alt="Foto que se quitará" className="aspect-[4/3] w-full rounded-lg object-cover opacity-50 grayscale" />
            ))}
          </div>
        </>
      )}
    </SectionCard>
  )
}

function LocationCard({ data }: { data: BarFields }) {
  return (
    <SectionCard title="Ubicación">
      <p className="mb-3 text-[15px]">
        {[data.address, data.neighborhood, data.city, data.state].filter(Boolean).join(', ') || '—'}
        {data.postalCode && `, C.P. ${data.postalCode}`}
      </p>
      {data.latitude != null && data.longitude != null ? (
        <>
          <div className="relative isolate z-0 aspect-[16/9] overflow-hidden rounded-xl border border-line">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <LocationMap lat={data.latitude} lng={data.longitude} label={data.name} />
            </Suspense>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            Verificar en Google Maps (Street View) <ArrowRight className="size-3.5" />
          </a>
        </>
      ) : <p className="text-sm text-fg-muted">Sin coordenadas.</p>}
    </SectionCard>
  )
}

function OwnerCard({ r }: { r: ReviewDetail }) {
  const o = r.owner
  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 font-sans text-base font-bold tracking-normal">Propietario</h2>
        <div className="flex items-center gap-3">
          <Avatar name={o.name} />
          <div className="min-w-0">
            <Link to={`/admin/usuarios/${o.id}`} className="block truncate font-semibold hover:underline">{o.name}</Link>
            <a href={`mailto:${o.email}`} className="flex items-center gap-1 truncate text-sm text-fg-muted hover:underline"><Mail className="size-3.5 shrink-0" />{o.email}</a>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {o.businessName && <div className="flex justify-between gap-3"><dt className="text-fg-muted">Negocio</dt><dd className="text-right font-medium">{o.businessName}</dd></div>}
          {o.contactPhone && <div className="flex justify-between gap-3"><dt className="text-fg-muted">Teléfono</dt><dd className="font-medium">{o.contactPhone}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-fg-muted">Cuenta</dt><dd><AccountStatusBadge status={o.accountStatus} /></dd></div>
          <div className="flex justify-between gap-3"><dt className="text-fg-muted">Establecimientos</dt><dd className="font-medium">{o.barCount} ({o.publishedCount} publicados)</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-fg-muted">Registro</dt><dd className="font-medium">{formatDate(o.createdAt)}</dd></div>
        </dl>
        {r.bar.status === 'published' && !r.revision && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-subtle p-3 text-sm text-fg-muted"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Para retirar este bar temporalmente usa «Suspender publicación».</p>
        )}
      </CardBody>
    </Card>
  )
}
