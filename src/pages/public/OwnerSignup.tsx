import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Camera, Check, CheckCircle2, Clock, MailWarning, MapPin, ShieldAlert, ShieldCheck, Store,
} from 'lucide-react'
import { Honeypot } from '@/components/auth/fields'
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Select, Skeleton, Textarea, buttonVariants, useToast } from '@/components/ui'
import { firstName, useResendVerification, useSession } from '@/features/auth/session'
import { APPLICANT_ROLES, useMyApplications, useSubmitApplication, type ApplicationInput, type OwnerApplication } from '@/features/owner/application'
import { ApiError, fieldError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import type { SessionUser } from '@/types/auth'

/**
 * /registra-tu-bar — una sola página que se adapta al estado del usuario:
 * anónimo → sin verificar → formulario → en revisión → rechazada (reintentar) → aprobada.
 */
export default function OwnerSignup() {
  const { user, isLoading } = useSession()
  useDocumentMeta({
    title: 'Registra tu bar',
    description: 'Publica tu bar en Barmap: crea tu cuenta, envía tu solicitud y, una vez aprobada, registra tus establecimientos.',
  })

  return (
    <div className="container-page py-10 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,560px)] lg:gap-16">
        <Pitch />
        {/* Con sesión, el estado de la solicitud es lo primero en móvil. */}
        <div className={user ? 'order-first lg:order-none lg:pt-2' : 'lg:pt-2'}>
          {isLoading ? <Skeleton className="h-96 rounded-3xl" /> : !user ? <Anonymous /> : <ForUser user={user} />}
        </div>
      </div>
    </div>
  )
}

function Pitch() {
  const benefits = [
    { icon: MapPin, title: 'Aparece en el mapa', text: 'Te encuentran quienes buscan a dónde ir cerca de ti.' },
    { icon: Camera, title: 'Tu mejor cara', text: 'Fotos, horarios, servicios y cómo llegar en una sola página.' },
    { icon: BarChart3, title: 'Mide tus visitas', text: 'Consulta cuántas personas ven tu establecimiento.' },
    { icon: ShieldCheck, title: 'Perfiles revisados', text: 'Revisamos cada solicitud para que la información sea confiable.' },
  ]
  return (
    <div>
      <Badge tone="brand" size="md">Para negocios</Badge>
      <h1 className="mt-4 text-[36px] font-extrabold leading-[1.05] md:text-[52px]">Haz que tu bar sea fácil de encontrar</h1>
      <p className="mt-4 max-w-xl text-lg text-fg-muted">Publicar en Barmap es gratis. Revisamos cada solicitud para mantener información real y útil.</p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {benefits.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="text-[15px] text-fg-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <ol className="mt-10 space-y-3 rounded-3xl bg-subtle p-6 text-[15px]">
        {['Crea tu cuenta y confirma tu correo', 'Envía tu solicitud de propietario', 'Nuestro equipo la revisa (24–48 h hábiles)', 'Registra tu bar y envíalo a publicación'].map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <Card className="p-6 shadow-md md:p-8">{children}</Card>
}

function Anonymous() {
  return (
    <Panel>
      <h2 className="text-2xl font-bold">Empieza en 2 minutos</h2>
      <p className="mt-2 text-[15px] text-fg-muted">Crea una cuenta con tu correo. Después completarás los datos de tu negocio.</p>
      <div className="mt-6 grid gap-3">
        <Link to="/registro?next=/registra-tu-bar" className={buttonVariants({ size: 'lg', block: true })}>Crear cuenta <ArrowRight /></Link>
        <Link to="/entrar?next=/registra-tu-bar" className={buttonVariants({ variant: 'outline', size: 'lg', block: true })}>Ya tengo cuenta</Link>
      </div>
    </Panel>
  )
}

function ForUser({ user }: { user: SessionUser }) {
  const apps = useMyApplications(user.role === 'visitor')
  const resend = useResendVerification()
  const toast = useToast()

  if (user.accountStatus === 'suspended') {
    return <Panel><Alert tone="danger" title="Tu cuenta está suspendida">Contacta a soporte si crees que se trata de un error.</Alert></Panel>
  }
  if (user.role === 'owner') {
    return (
      <Panel>
        <CheckCircle2 className="size-10 text-success-600" />
        <h2 className="mt-4 text-2xl font-bold">Ya eres propietario en Barmap</h2>
        <p className="mt-2 text-[15px] text-fg-muted">Registra y administra tus establecimientos desde tu panel.</p>
        <Link to="/panel" className={buttonVariants({ size: 'lg', block: true, className: 'mt-6' })}>Ir a mi panel <ArrowRight /></Link>
      </Panel>
    )
  }
  if (user.role === 'admin') {
    return <Panel><Alert tone="info" title="Cuenta de administración">Las cuentas de administración no pueden solicitar acceso de propietario.</Alert></Panel>
  }
  if (!user.emailVerified) {
    return (
      <Panel>
        <MailWarning className="size-10 text-warning-700" />
        <h2 className="mt-4 text-2xl font-bold">Confirma tu correo para continuar</h2>
        <p className="mt-2 text-[15px] text-fg-muted">
          Enviamos un enlace a <strong className="text-fg">{user.email}</strong>. Necesitamos confirmar que es tuyo antes de revisar tu solicitud.
        </p>
        <Button
          variant="outline"
          block
          className="mt-6"
          loading={resend.isPending}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: () => toast({ tone: 'success', title: 'Enlace enviado', description: 'Revisa tu bandeja de entrada.' }),
              onError: (e) => toast({ tone: 'error', title: 'No se pudo enviar', description: e.message }),
            })
          }
        >
          Reenviar enlace
        </Button>
      </Panel>
    )
  }
  if (apps.isLoading) return <Skeleton className="h-96 rounded-3xl" />

  const latest = apps.data?.[0]
  if (latest?.status === 'pending') return <PendingStatus app={latest} name={user.name} />
  return <ApplicationForm previous={latest?.status === 'rejected' ? latest : undefined} />
}

function PendingStatus({ app, name }: { app: OwnerApplication; name: string }) {
  const steps = [
    { label: 'Solicitud enviada', detail: formatDate(app.createdAt), done: true },
    { label: 'En revisión', detail: 'Normalmente 24–48 h hábiles', current: true },
    { label: 'Acceso a tu panel', detail: 'Te avisaremos por correo' },
  ]
  return (
    <Panel>
      <Badge tone="warning" dot size="md">En revisión</Badge>
      <h2 className="mt-4 text-2xl font-bold">¡Gracias, {firstName(name)}! Estamos revisando tu solicitud</h2>
      <p className="mt-2 text-[15px] text-fg-muted">Te escribiremos en cuanto tengamos una respuesta. Mientras tanto no necesitas hacer nada más.</p>
      <ol className="mt-7 space-y-5">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-ink-900 text-white' : s.current ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'border border-line-strong text-fg-subtle'}`}>
              {s.done ? <Check className="size-4" strokeWidth={3} /> : s.current ? <Clock className="size-4" /> : <Store className="size-4" />}
            </span>
            <span>
              <span className="block font-semibold">{s.label}</span>
              <span className="text-sm text-fg-muted">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <dl className="mt-7 grid gap-3 rounded-2xl bg-subtle p-5 text-[15px] sm:grid-cols-2">
        <div><dt className="text-sm text-fg-muted">Negocio</dt><dd className="font-semibold">{app.businessName}</dd></div>
        <div><dt className="text-sm text-fg-muted">Teléfono</dt><dd className="font-semibold">{app.contactPhone}</dd></div>
        {app.details.city && <div><dt className="text-sm text-fg-muted">Ciudad</dt><dd className="font-semibold">{app.details.city}</dd></div>}
      </dl>
    </Panel>
  )
}

const EMPTY: ApplicationInput = { businessName: '', contactPhone: '', city: '', role: 'owner', website: '', instagram: '', notes: '', website_url: '' }

function ApplicationForm({ previous }: { previous?: OwnerApplication }) {
  const submit = useSubmitApplication()
  const toast = useToast()
  const [form, setForm] = useState<ApplicationInput>(() =>
    previous
      ? {
          ...EMPTY,
          businessName: previous.businessName,
          contactPhone: previous.contactPhone,
          city: previous.details.city ?? '',
          role: (previous.details.role as ApplicationInput['role']) ?? 'owner',
          website: previous.details.website ?? '',
          instagram: previous.details.instagram ?? '',
          notes: previous.notes ?? '',
        }
      : EMPTY,
  )
  const [confirmed, setConfirmed] = useState(false)
  const [touched, setTouched] = useState(false)
  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const local = {
    businessName: form.businessName.trim().length < 2 ? 'Escribe el nombre de tu negocio' : undefined,
    contactPhone: !/^\+?[\d\s()-]{7,25}$/.test(form.contactPhone.trim()) ? 'Escribe un teléfono válido (solo números, espacios o guiones)' : undefined,
    city: form.city.trim().length < 2 ? 'Escribe la ciudad' : undefined,
    confirmed: !confirmed ? 'Confirma que administras este negocio' : undefined,
  }
  const err = (k: keyof ApplicationInput) => (touched ? (local as Record<string, string | undefined>)[k] : undefined) ?? fieldError(submit.error, k)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (Object.values(local).some(Boolean)) return
    submit.mutate(form, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Solicitud enviada', description: 'Te avisaremos por correo cuando la revisemos.' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    })
  }
  const generalError = submit.error && !(submit.error instanceof ApiError && submit.error.details)

  return (
    <Panel>
      {previous && (
        <Alert tone="warning" className="mb-6" title="Tu solicitud anterior no fue aprobada">
          <p><strong>Motivo:</strong> {previous.rejectionReason}</p>
          <p className="mt-1">Corrige la información y vuelve a enviarla.</p>
        </Alert>
      )}
      <h2 className="text-2xl font-bold">{previous ? 'Envía tu solicitud de nuevo' : 'Solicitud de propietario'}</h2>
      <p className="mt-2 text-[15px] text-fg-muted">Estos datos solo los ve nuestro equipo de revisión. No se publican.</p>

      <form onSubmit={onSubmit} noValidate className="relative mt-7 space-y-5">
        {generalError && <Alert tone="danger" title={submit.error!.message} />}
        <Field label="Nombre del negocio o grupo" error={err('businessName')} hint="Si administras varios bares, usa el nombre del grupo.">
          <Input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} maxLength={160} autoComplete="organization" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Teléfono de contacto" error={err('contactPhone')}>
            <Input type="tel" inputMode="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} maxLength={25} autoComplete="tel" placeholder="55 1234 5678" />
          </Field>
          <Field label="Ciudad" error={err('city')}>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} autoComplete="address-level2" />
          </Field>
        </div>
        <Field label="Tu relación con el negocio" error={err('role')}>
          <Select value={form.role} onChange={(e) => set('role', e.target.value as ApplicationInput['role'])}>
            {Object.entries(APPLICANT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sitio web" optional error={err('website')}>
            <Input value={form.website} onChange={(e) => set('website', e.target.value)} maxLength={300} placeholder="tubar.com" inputMode="url" />
          </Field>
          <Field label="Instagram" optional error={err('instagram')}>
            <Input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} maxLength={60} placeholder="@tubar" />
          </Field>
        </div>
        <Field label="Algo que debamos saber" optional hint="Cuántos establecimientos administras, desde cuándo, etc." error={err('notes')}>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} rows={3} />
        </Field>
        <div>
          <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label="Confirmo que administro este negocio y que la información es correcta" />
          {touched && local.confirmed && <p className="mt-1.5 text-[13px] font-medium text-danger-600">{local.confirmed}</p>}
        </div>
        <Honeypot value={form.website_url} onChange={(v) => set('website_url', v)} />
        <Button type="submit" size="lg" block loading={submit.isPending}>
          {previous ? 'Reenviar solicitud' : 'Enviar solicitud'}
        </Button>
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Podemos contactarte para verificar que administras el negocio.
        </p>
      </form>
    </Panel>
  )
}
