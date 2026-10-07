import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Mail, Power, ShieldOff } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { LogoMark } from '@/components/brand/Logo'
import {
  AccountStatusBadge, Alert, ApplicationStatusBadge, Avatar, Badge, Button, Card, CardBody, Chip, Field, Modal, PublicationStatusBadge, Skeleton, Textarea, useToast,
} from '@/components/ui'
import { ACTION_LABELS, ENTITY_LABELS } from '@/features/admin/labels'
import { useAdminUser, useUserStatus } from '@/features/admin/platform'
import { useSession } from '@/features/auth/session'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { formatDate } from '@/lib/format'
import { ROLE_LABEL } from './Users'

const REASONS = ['Publicó información falsa de forma reiterada.', 'Suplantación de identidad de un negocio.', 'Uso abusivo de la plataforma (spam).']

export default function UserDetail() {
  const { id = '' } = useParams()
  const q = useAdminUser(id)
  const { user: me } = useSession()
  const status = useUserStatus(id)
  const toast = useToast()
  const [modal, setModal] = useState<'suspend' | 'reactivate' | null>(null)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  useDocumentMeta({ title: q.data ? q.data.user.name : 'Usuario' })

  const back = <Link to="/admin/usuarios" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg"><ChevronLeft className="size-4" /> Usuarios</Link>
  if (q.isError) return <>{back}<Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card></>
  if (!q.data) return <>{back}<Skeleton className="h-96 rounded-2xl" /></>
  const { user: u, applications, bars, history } = q.data
  const canChange = u.role !== 'admin' && u.id !== me?.id

  const run = () => {
    setTouched(true)
    if (modal === 'suspend' && reason.trim().length < 10) return
    status.mutate(
      { action: modal!, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: modal === 'suspend' ? 'Cuenta suspendida' : 'Cuenta reactivada', description: modal === 'suspend' ? 'Se cerraron sus sesiones y sus bares dejaron de ser públicos.' : undefined })
          setModal(null)
        },
        onError: (e) => toast({ tone: 'error', title: 'No se pudo completar', description: e.message }),
      },
    )
  }

  return (
    <>
      {back}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={u.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-bold leading-tight md:text-[30px]">{u.name}</h1>
              <Badge size="md">{ROLE_LABEL[u.role]}</Badge>
              <AccountStatusBadge status={u.accountStatus} size="md" />
            </div>
            <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1.5 text-[15px] text-fg-muted hover:underline"><Mail className="size-4" />{u.email}</a>
          </div>
        </div>
        {canChange && (
          u.accountStatus === 'active'
            ? <Button variant="outline" onClick={() => { setReason(''); setTouched(false); setModal('suspend') }}><ShieldOff /> Suspender cuenta</Button>
            : <Button onClick={() => { setReason(''); setModal('reactivate') }}><Power /> Reactivar cuenta</Button>
        )}
      </div>

      {u.accountStatus === 'suspended' && <Alert tone="danger" className="mb-6" title="Cuenta suspendida">{u.suspendedReason && <>Motivo: “{u.suspendedReason}”</>}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="mb-3 font-sans text-base font-bold tracking-normal">Cuenta</h2>
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between gap-3"><dt className="text-fg-muted">Registro</dt><dd>{formatDate(u.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-muted">Correo verificado</dt><dd>{u.emailVerifiedAt ? formatDate(u.emailVerifiedAt) : 'No'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-muted">Último acceso</dt><dd>{u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</dd></div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="mb-3 font-sans text-base font-bold tracking-normal">Solicitudes de propietario</h2>
            {applications.length === 0 ? <p className="text-[15px] text-fg-muted">Sin solicitudes.</p> : (
              <ul className="space-y-2">
                {applications.map((a) => (
                  <li key={a.id}>
                    <Link to={`/admin/solicitudes/${a.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-subtle p-3 text-sm hover:bg-ink-100">
                      <span><span className="font-semibold">{a.businessName}</span><span className="block text-fg-muted">{formatDate(a.createdAt)}</span></span>
                      <ApplicationStatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <h2 className="mb-3 font-sans text-base font-bold tracking-normal">Establecimientos ({bars.length})</h2>
          {bars.length === 0 ? <p className="text-[15px] text-fg-muted">Sin establecimientos.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {bars.map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/moderacion/${b.id}`} className="flex items-center gap-3 rounded-xl border border-line p-2.5 hover:border-ink-300">
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100 text-ink-300">{b.coverUrl ? <img src={b.coverUrl} alt="" className="h-full w-full object-cover" /> : <LogoMark className="size-6" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{b.name}</span><span className="block truncate text-sm text-fg-muted">{b.city ?? '—'}</span></span>
                    <PublicationStatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {history.length > 0 && (
        <Card className="mt-6">
          <CardBody>
            <h2 className="mb-3 font-sans text-base font-bold tracking-normal">Historial de moderación</h2>
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {history.map((h, i) => (
                <li key={i}>
                  <p><span className="font-semibold">{h.adminName}</span> {ACTION_LABELS[h.action] ?? h.action} · {ENTITY_LABELS[h.entityType as keyof typeof ENTITY_LABELS] ?? h.entityType}</p>
                  {h.comment && <p className="text-ink-600">“{h.comment}”</p>}
                  <p className="text-xs text-fg-subtle">{formatDate(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'suspend' ? `¿Suspender a ${u.name}?` : `¿Reactivar a ${u.name}?`}
        description={modal === 'suspend' ? 'Se cerrarán sus sesiones, no podrá gestionar establecimientos y sus bares dejarán de mostrarse al público.' : 'Recuperará el acceso y sus bares publicados volverán a mostrarse.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant={modal === 'suspend' ? 'danger' : 'primary'} onClick={run} loading={status.isPending}>{modal === 'suspend' ? 'Suspender' : 'Reactivar'}</Button>
          </>
        }
      >
        {modal === 'suspend' && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">{REASONS.map((r) => <Chip key={r} selected={reason === r} onClick={() => setReason(r)} className="h-auto whitespace-normal py-2 text-left">{r}</Chip>)}</div>
            <Field label="Motivo (se le enviará por correo)" error={touched && reason.trim().length < 10 ? 'Escribe al menos 10 caracteres' : undefined}>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
            </Field>
          </>
        )}
      </Modal>
    </>
  )
}
