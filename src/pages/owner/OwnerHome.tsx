import { Link, useNavigate } from 'react-router-dom'
import { Bell, ClipboardCheck, Eye, MessageSquareWarning, Plus, Store } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/dashboard/StatCard'
import { Alert, Card, CardBody, EmptyState, Skeleton, buttonVariants } from '@/components/ui'
import { firstName, useSession } from '@/features/auth/session'
import { useOwnerOverview } from '@/features/owner/bars'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { formatDate } from '@/lib/format'
import { AccountView } from '@/pages/account/AccountView'

export default function OwnerHome() {
  const { user } = useSession()
  const overview = useOwnerOverview()
  useDocumentMeta({ title: 'Mi panel' })
  if (!user) return null
  const suspended = user.accountStatus === 'suspended'
  const o = overview.data

  return (
    <>
      <PageHeader
        eyebrow={user.application?.businessName}
        title={`Hola, ${firstName(user.name)}`}
        description="Gestiona tus establecimientos y sigue el estado de cada publicación."
        actions={!suspended && <Link to="/panel/establecimientos/nuevo" className={buttonVariants()}><Plus /> Agregar establecimiento</Link>}
      />

      {suspended && (
        <Alert tone="danger" className="mb-6" title="Tu cuenta está suspendida">
          Puedes consultar tu información, pero no registrar ni editar establecimientos. Contacta a soporte.
        </Alert>
      )}
      {o && o.changesRequested > 0 && (
        <Alert
          tone="warning"
          className="mb-6"
          title={`${o.changesRequested} ${o.changesRequested === 1 ? 'publicación requiere' : 'publicaciones requieren'} tu atención`}
          action={<Link to="/panel/establecimientos" className={buttonVariants({ variant: 'dark', size: 'sm' })}>Revisar</Link>}
        >
          Nuestro equipo pidió cambios o no aprobó una publicación. Revisa los comentarios.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {!o ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Establecimientos" value={o.total} icon={Store} hint={o.drafts ? `${o.drafts} en borrador` : undefined} />
            <StatCard label="Publicados" value={o.published} icon={Eye} tone="success" />
            <StatCard label="En revisión" value={o.pending} icon={ClipboardCheck} tone="info" />
            <StatCard label="Requieren cambios" value={o.changesRequested} icon={MessageSquareWarning} tone="warning" />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="flex items-center gap-2 font-sans text-base font-bold tracking-normal"><Bell className="size-4" /> Actividad reciente</h2>
            {!o ? (
              <Skeleton className="mt-4 h-24" />
            ) : o.activity.length === 0 ? (
              <p className="mt-4 text-[15px] text-fg-muted">Aquí verás las respuestas de nuestro equipo sobre tu cuenta y tus publicaciones.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {o.activity.map((a) => (
                  <li key={a.id} className="py-3">
                    {a.link ? <Link to={a.link} className="font-semibold hover:underline">{a.title}</Link> : <p className="font-semibold">{a.title}</p>}
                    {a.body && <p className="line-clamp-2 text-sm text-fg-muted">{a.body}</p>}
                    <p className="mt-0.5 text-xs text-fg-subtle">{formatDate(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="bg-subtle">
          <CardBody>
            <h2 className="font-sans text-base font-bold tracking-normal">Visitas en los últimos 30 días</h2>
            {o ? <p className="mt-3 font-display text-4xl font-bold tabular-nums">{o.views30d.toLocaleString('es-MX')}</p> : <Skeleton className="mt-3 h-10 w-32" />}
            <p className="mt-2 text-sm text-fg-muted">Personas que abrieron la página de tus bares publicados. Estadísticas detalladas en la Etapa 6.</p>
          </CardBody>
        </Card>
      </div>

      {o && o.total === 0 && !suspended && (
        <Card className="mt-8">
          <EmptyState
            icon={Store}
            title="Registra tu primer establecimiento"
            description="Te guiamos en 5 pasos: información, ubicación, horarios y servicios, fotos y revisión."
            action={<Link to="/panel/establecimientos/nuevo" className={buttonVariants()}><Plus /> Empezar</Link>}
          />
        </Card>
      )}
    </>
  )
}

export function OwnerAccount() {
  const { user } = useSession()
  const navigate = useNavigate()
  useDocumentMeta({ title: 'Mi cuenta' })
  if (!user) return null
  return (
    <>
      <PageHeader title="Mi cuenta" />
      <AccountView user={user} onLoggedOut={() => navigate('/', { replace: true })} />
    </>
  )
}
