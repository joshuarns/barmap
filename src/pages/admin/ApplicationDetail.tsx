import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ExternalLink, History, Mail, Phone, X } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import {
  AccountStatusBadge, Alert, ApplicationStatusBadge, Avatar, Badge, Button, Card, CardBody, Chip, Field, Modal, Skeleton, Textarea, useToast,
} from '@/components/ui'
import { useApplication, useDecideApplication, type ApplicationDetail as Detail } from '@/features/admin/applications'
import { APPLICANT_ROLES } from '@/features/owner/application'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { formatDate } from '@/lib/format'

const QUICK_REASONS = [
  'No pudimos verificar que administras el negocio.',
  'Los datos de contacto no son válidos o no respondieron.',
  'El negocio no corresponde a un bar o establecimiento de vida nocturna.',
  'La información está incompleta. Agrega sitio web o redes sociales del negocio.',
]

const ACTION_LABELS: Record<string, string> = { approve: 'Aprobó la solicitud', reject: 'Rechazó la solicitud', suspend: 'Suspendió la cuenta', reactivate: 'Reactivó la cuenta' }

export default function ApplicationDetail() {
  const { id = '' } = useParams()
  const q = useApplication(id)
  useDocumentMeta({ title: q.data ? `Solicitud · ${q.data.application.name}` : 'Solicitud' })

  return (
    <>
      <Link to="/admin/solicitudes" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Solicitudes
      </Link>
      {q.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 rounded-2xl" /></div>
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
      ) : (
        <DetailView data={q.data!} />
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="text-[15px] font-medium text-fg">{children}</dd>
    </div>
  )
}

function DetailView({ data }: { data: Detail }) {
  const { application: a, previous, history } = data
  const decide = useDecideApplication(a.id)
  const toast = useToast()
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const pending = a.status === 'pending'
  const reasonError = touched && reason.trim().length < 10 ? 'Explica el motivo (mínimo 10 caracteres). El solicitante lo verá.' : undefined

  const run = (decision: 'approve' | 'reject') => {
    if (decision === 'reject') {
      setTouched(true)
      if (reason.trim().length < 10) return
    }
    decide.mutate(
      { decision, reason: decision === 'reject' ? reason.trim() : undefined, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setModal(null)
          toast({
            tone: 'success',
            title: decision === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada',
            description: decision === 'approve' ? `${a.name} ya puede registrar establecimientos.` : 'Le enviamos el motivo por correo.',
          })
        },
        onError: (e) => toast({ tone: 'error', title: 'No se pudo guardar la decisión', description: e.message }),
      },
    )
  }

  return (
    <div className="pb-24 md:pb-0">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={a.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-bold leading-tight md:text-[30px]">{a.name}</h1>
              <ApplicationStatusBadge status={a.status} size="md" />
            </div>
            <p className="text-[15px] text-fg-muted">{a.businessName} · enviada el {formatDate(a.createdAt)}</p>
          </div>
        </div>
        {pending && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-line bg-surface p-4 md:static md:border-0 md:bg-transparent md:p-0">
            <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setModal('reject')}><X /> Rechazar</Button>
            <Button className="flex-1 md:flex-none" onClick={() => setModal('approve')}><Check /> Aprobar</Button>
          </div>
        )}
      </div>

      {!pending && (
        <Alert tone={a.status === 'approved' ? 'success' : 'danger'} className="mb-6" title={a.status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada'}>
          {a.reviewedBy && <>Revisada por {a.reviewedBy} el {formatDate(a.reviewedAt!)}.</>}
          {a.rejectionReason && <p className="mt-1"><strong>Motivo:</strong> {a.rejectionReason}</p>}
        </Alert>
      )}
      {a.accountStatus === 'suspended' && <Alert tone="danger" className="mb-6" title="La cuenta de este usuario está suspendida" />}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="font-sans text-base font-bold tracking-normal">Datos del negocio</h2>
            <dl className="mt-2 divide-y divide-line">
              <Row label="Negocio">{a.businessName}</Row>
              <Row label="Teléfono">
                <a href={`tel:${a.contactPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:underline"><Phone className="size-4 text-fg-muted" />{a.contactPhone}</a>
              </Row>
              {a.details.city && <Row label="Ciudad">{a.details.city}</Row>}
              {a.details.role && <Row label="Relación con el negocio">{APPLICANT_ROLES[a.details.role as keyof typeof APPLICANT_ROLES] ?? a.details.role}</Row>}
              {a.details.website && (
                <Row label="Sitio web">
                  <a href={a.details.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 break-all hover:underline">
                    {a.details.website} <ExternalLink className="size-3.5 shrink-0 text-fg-subtle" />
                  </a>
                </Row>
              )}
              {a.details.instagram && <Row label="Instagram">{a.details.instagram}</Row>}
              <Row label="Notas del solicitante">
                {a.notes ? <span className="whitespace-pre-line font-normal">{a.notes}</span> : <span className="font-normal text-fg-subtle">Sin notas</span>}
              </Row>
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="font-sans text-base font-bold tracking-normal">Cuenta del solicitante</h2>
              <dl className="mt-2 divide-y divide-line">
                <Row label="Correo">
                  <a href={`mailto:${a.email}`} className="inline-flex items-center gap-2 break-all hover:underline"><Mail className="size-4 shrink-0 text-fg-muted" />{a.email}</a>
                </Row>
                <Row label="Correo verificado">{a.emailVerifiedAt ? <Badge tone="success" dot>Sí, {formatDate(a.emailVerifiedAt)}</Badge> : <Badge tone="warning" dot>No</Badge>}</Row>
                <Row label="Registro">{formatDate(a.userCreatedAt)}</Row>
                <Row label="Último acceso">{a.lastLoginAt ? formatDate(a.lastLoginAt) : '—'}</Row>
                <Row label="Estado">
                  <span className="flex flex-wrap items-center gap-2">
                    <AccountStatusBadge status={a.accountStatus} />
                    <Badge>{a.role === 'owner' ? 'Propietario' : a.role === 'admin' ? 'Admin' : 'Visitante'}</Badge>
                  </span>
                </Row>
              </dl>
            </CardBody>
          </Card>

          {(previous.length > 0 || history.length > 0) && (
            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 font-sans text-base font-bold tracking-normal"><History className="size-4" /> Historial</h2>
                {previous.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {previous.map((p) => (
                      <li key={p.id} className="rounded-xl bg-subtle p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{p.businessName}</span>
                          <ApplicationStatusBadge status={p.status} />
                        </div>
                        <p className="text-fg-muted">{formatDate(p.createdAt)}</p>
                        {p.rejectionReason && <p className="mt-1 text-ink-700">“{p.rejectionReason}”</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {history.length > 0 && (
                  <ol className="mt-4 space-y-3 border-l border-line pl-4">
                    {history.map((h, i) => (
                      <li key={i} className="text-sm">
                        <p><span className="font-semibold">{h.adminName}</span> {ACTION_LABELS[h.action]?.toLowerCase() ?? h.action}</p>
                        <p className="text-fg-muted">{formatDate(h.createdAt)}</p>
                        {h.comment && <p className="mt-0.5 text-ink-700">“{h.comment}”</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        title={`¿Aprobar a ${a.name}?`}
        description="Podrá registrar establecimientos y enviarlos a revisión. Cada publicación seguirá necesitando tu aprobación."
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={() => run('approve')} loading={decide.isPending}><Check /> Aprobar</Button>
          </>
        }
      >
        <Field label="Nota interna" optional hint="Solo la ve el equipo de administración.">
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Ej. Verificado por llamada telefónica." />
        </Field>
      </Modal>

      <Modal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        title={`¿Rechazar la solicitud de ${a.name}?`}
        description="Le enviaremos el motivo por correo. Podrá corregir la información y volver a solicitar acceso."
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => run('reject')} loading={decide.isPending}>Rechazar solicitud</Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <Chip key={r} selected={reason === r} onClick={() => setReason(r)} className="h-auto whitespace-normal py-2 text-left">{r}</Chip>
          ))}
        </div>
        <Field label="Motivo (visible para el solicitante)" error={reasonError}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Field>
      </Modal>
    </div>
  )
}
