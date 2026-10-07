import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ChevronLeft, ExternalLink, Save, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { Alert, Button, Card, Modal, PublicationStatusBadge, Skeleton, Stepper, useToast } from '@/components/ui'
import { useCatalog } from '@/features/bars/queries'
import {
  STEP_FIELDS, stepOf, useCreateBar, useDiscardRevision, useSaveBar, useSubmitBar, useWorkingCopy, validateSteps,
  type BarFields, type WorkingCopy,
} from '@/features/owner/bars'
import { StepGeneral } from '@/features/owner/steps/StepGeneral'
import { StepLocation } from '@/features/owner/steps/StepLocation'
import { StepDetails } from '@/features/owner/steps/StepDetails'
import { StepPhotos } from '@/features/owner/steps/StepPhotos'
import { StepReview } from '@/features/owner/steps/StepReview'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ApiError, apiPut } from '@/lib/api'
import type { Catalog } from '@/types/api'

const STEPS = ['Información', 'Ubicación', 'Detalles', 'Fotos', 'Revisión']

const EMPTY: BarFields = {
  name: '', description: '', categoryId: null, typeId: null, country: 'MX', state: '', city: '', neighborhood: '', address: '',
  postalCode: '', latitude: null, longitude: null, phone: '', website: '', social: { instagram: '', facebook: '', tiktok: '' },
  priceRange: null, hours: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isClosed: true, opens: null, closes: null })), amenityIds: [],
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Convierte los errores 422 del servidor ({campo: [msg]}) al formato del formulario. */
const serverErrors = (e: unknown) =>
  e instanceof ApiError && e.details ? Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, v[0]])) : {}

function useFormState(initial: BarFields) {
  const [form, setForm] = useState(initial)
  const set = useCallback(<K extends keyof BarFields>(k: K, v: BarFields[K]) => setForm((f) => ({ ...f, [k]: v })), [])
  const patch = useCallback((p: Partial<BarFields>) => setForm((f) => ({ ...f, ...p })), [])
  return { form, setForm, set, patch }
}

// ---------------------------------------------------------------------
// Alta: solo el paso 1; al continuar se crea el borrador
// ---------------------------------------------------------------------
export function NewBar() {
  const queryClient = useQueryClient()
  const catalog = useCatalog()
  const create = useCreateBar()
  const navigate = useNavigate()
  const toast = useToast()
  const { form, set, patch } = useFormState(EMPTY)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentMeta({ title: 'Agregar establecimiento' })

  const errors = useMemo(() => {
    const all = validateSteps(form, 0)
    return Object.fromEntries(STEP_FIELDS[0].filter((f) => all[f]).map((f) => [f, all[f]]))
  }, [form])

  const next = async () => {
    setShow(true)
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      const wc = await create.mutateAsync(form.name.trim())
      // Guarda el resto del paso 1 y deja en caché la versión guardada
      // (si no, el editor arrancaría con la copia previa sin estos datos).
      const saved = await apiPut<WorkingCopy>(`/owner/bars/${wc.bar.id}`, { ...wc.data, ...form, name: form.name.trim() })
      queryClient.setQueryData(['owner', 'bars', 'detail', wc.bar.id], saved)
      navigate(`/panel/establecimientos/${wc.bar.id}?paso=2`, { replace: true })
    } catch (e) {
      toast({ tone: 'error', title: 'No se pudo crear el borrador', description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <EditorFrame title="Agregar establecimiento" step={0}>
      {!catalog.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <StepCard>
          <StepGeneral form={form} set={set} patch={patch} errors={show ? errors : {}} catalog={catalog.data} />
        </StepCard>
      )}
      <FooterBar>
        <Link to="/panel/establecimientos" className="text-sm font-semibold text-fg-muted hover:text-fg">Cancelar</Link>
        <Button variant="dark" onClick={next} loading={busy}>Guardar y continuar <ArrowRight /></Button>
      </FooterBar>
    </EditorFrame>
  )
}

// ---------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------
export default function BarEditor() {
  const { id = '' } = useParams()
  const wc = useWorkingCopy(id)
  const catalog = useCatalog()
  useDocumentMeta({ title: wc.data ? `Editar · ${wc.data.data.name}` : 'Editar establecimiento' })

  if (wc.isError) {
    return <><BackLink /><Card><ErrorState error={wc.error} onRetry={() => wc.refetch()} /></Card></>
  }
  if (!wc.data || !catalog.data) {
    return <><BackLink /><Skeleton className="mb-6 h-10 w-80" /><Skeleton className="h-[480px] rounded-2xl" /></>
  }
  // key: si el servidor cambia de modo (p. ej. se descartó la revisión) se reinicia el formulario.
  return <Editor key={`${wc.data.bar.id}-${wc.data.revision?.id ?? 'live'}`} wc={wc.data} catalog={catalog.data} />
}

function Editor({ wc, catalog }: { wc: WorkingCopy; catalog: Catalog }) {
  const id = wc.bar.id
  const [params, setParams] = useSearchParams()
  const step = Math.min(Math.max(Number(params.get('paso')) || 1, 1), 5) - 1
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveBar(id)
  const submit = useSubmitBar(id)
  const discard = useDiscardRevision(id)
  const { form, setForm, set, patch } = useFormState(wc.data)
  const [saved, setSaved] = useState(wc.data)
  const [shown, setShown] = useState<Set<number>>(new Set())
  const [srvErrors, setSrvErrors] = useState<Record<string, string>>({})
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const leaving = useRef(false)

  const dirty = !same(form, saved)
  const locked = !!wc.lockReason
  const allErrors = useMemo(() => ({ ...validateSteps(form, wc.images.length), ...srvErrors }), [form, wc.images.length, srvErrors])
  const stepErrors = (s: number) => Object.fromEntries(STEP_FIELDS[s].filter((f) => allErrors[f]).map((f) => [f, allErrors[f]]))
  const visibleErrors = shown.has(step) ? stepErrors(step) : {}
  const missing = Object.entries(allErrors).map(([field, message]) => ({ field, message, step: Math.max(stepOf(field), 0) }))

  const goto = (s: number) => {
    setParams((p) => { p.set('paso', String(s + 1)); return p }, { replace: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const doSave = async (quiet = false) => {
    if (!dirty) return true
    try {
      const res = await save.mutateAsync(form)
      setForm(res.data)
      setSaved(res.data)
      setSrvErrors({})
      if (!quiet) toast({ tone: 'success', title: 'Borrador guardado', description: wc.bar.status === 'published' ? 'Tus cambios aún no son públicos.' : undefined })
      return true
    } catch (e) {
      setSrvErrors(serverErrors(e))
      setShown(new Set([0, 1, 2, 3, 4]))
      toast({ tone: 'error', title: 'No se pudo guardar', description: (e as Error).message })
      return false
    }
  }

  const next = async () => {
    setShown((s) => new Set(s).add(step))
    if (Object.keys(stepErrors(step)).length) {
      document.querySelector('[aria-invalid="true"], .border-danger-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (await doSave(true)) goto(step + 1)
  }

  const trySubmit = async () => {
    setShown(new Set([0, 1, 2, 3, 4]))
    if (missing.length) return
    if (await doSave(true)) setConfirmSubmit(true)
  }

  const doSubmit = () =>
    submit.mutate(undefined, {
      onSuccess: () => {
        leaving.current = true
        setConfirmSubmit(false)
        toast({ tone: 'success', title: 'Enviado a revisión', description: 'Te avisaremos cuando nuestro equipo lo revise.' })
        navigate('/panel/establecimientos')
      },
      onError: (e) => {
        setConfirmSubmit(false)
        setSrvErrors(serverErrors(e))
        toast({ tone: 'error', title: 'No se pudo enviar', description: e.message })
      },
    })

  // Aviso de cambios sin guardar (navegación interna y cierre de pestaña).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const isRevisionMode = wc.bar.status === 'published'
  const props = { form, set, patch, errors: visibleErrors, catalog }

  return (
    <EditorFrame
      title={saved.name || 'Establecimiento'}
      step={locked ? undefined : step}
      onStep={locked ? undefined : (s) => goto(s)}
      badge={<PublicationStatusBadge status={wc.bar.status} size="md" />}
      actions={wc.bar.status === 'published' && (
        <a href={`/bares/${wc.bar.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
          Ver página pública <ExternalLink className="size-3.5" />
        </a>
      )}
    >
      <StatusBanner wc={wc} onDiscard={() => setConfirmDiscard(true)} />

      {wc.duplicates.length > 0 && !locked && (
        <Alert tone="warning" className="mb-6" title="Ya existe un establecimiento con este nombre en la misma ciudad">
          {wc.duplicates.map((d) => `${d.name} (${d.city})${d.isOwn ? ' — es tuyo' : ''}`).join(' · ')}. Si es el mismo lugar, no lo registres dos veces.
        </Alert>
      )}

      {locked ? (
        <StepReview form={form} images={wc.images} catalog={catalog} barId={id} missing={[]} onEdit={() => {}} readOnly />
      ) : (
        <>
          {step === 3 ? (
            <StepCard>
              <StepPhotos barId={id} images={wc.images} error={shown.has(3) ? allErrors.images : undefined} />
            </StepCard>
          ) : step === 4 ? (
            <StepReview form={form} images={wc.images} catalog={catalog} barId={id} missing={missing} onEdit={goto} />
          ) : (
            <StepCard>
              {step === 0 && <StepGeneral {...props} />}
              {step === 1 && <StepLocation {...props} />}
              {step === 2 && <StepDetails {...props} />}
            </StepCard>
          )}

          <FooterBar>
            <Button variant="ghost" onClick={() => goto(step - 1)} disabled={step === 0} aria-label="Paso anterior" className="px-3 sm:px-5">
              <ArrowLeft /> <span className="hidden sm:inline">Atrás</span>
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              {dirty && <span className="hidden text-sm text-fg-muted sm:inline">Cambios sin guardar</span>}
              <Button variant="outline" onClick={() => doSave()} loading={save.isPending && !submit.isPending} disabled={!dirty}>
                <Save /> <span className="hidden sm:inline">Guardar borrador</span><span className="sm:hidden">Guardar</span>
              </Button>
              {step < 4 ? (
                <Button variant="dark" onClick={next}>Continuar <ArrowRight /></Button>
              ) : (
                <Button onClick={trySubmit} disabled={missing.length > 0}>
                  <Send /> <span className="sm:hidden">Enviar</span>
                  <span className="hidden sm:inline">{isRevisionMode ? 'Enviar cambios' : 'Enviar a revisión'}</span>
                </Button>
              )}
            </div>
          </FooterBar>
        </>
      )}

      <Modal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title={isRevisionMode ? '¿Enviar tus cambios a revisión?' : '¿Enviar a revisión?'}
        description={
          isRevisionMode
            ? 'La versión actual seguirá visible hasta que aprobemos los cambios. Mientras tanto no podrás editarlos.'
            : 'Nuestro equipo revisará la información en 24–48 h hábiles. Mientras esté en revisión no podrás editarla.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>Seguir editando</Button>
            <Button onClick={doSubmit} loading={submit.isPending}><Send /> Enviar</Button>
          </>
        }
      />

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="¿Descartar los cambios no enviados?"
        description="Volverás a la versión publicada. Las fotos nuevas que subiste en esta versión se eliminarán."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={discard.isPending}
              onClick={() =>
                discard.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmDiscard(false)
                    toast({ tone: 'success', title: 'Cambios descartados' })
                  },
                  onError: (e) => toast({ tone: 'error', title: 'No se pudieron descartar', description: e.message }),
                })
              }
            >
              Descartar
            </Button>
          </>
        }
      />

      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Tienes cambios sin guardar"
        description="¿Quieres guardarlos antes de salir?"
        footer={
          <>
            <Button variant="ghost" onClick={() => blocker.proceed?.()}>Salir sin guardar</Button>
            <Button variant="dark" onClick={async () => ((await doSave(true)) ? blocker.proceed?.() : blocker.reset?.())} loading={save.isPending}>
              Guardar y salir
            </Button>
          </>
        }
      />
    </EditorFrame>
  )
}

function StatusBanner({ wc, onDiscard }: { wc: WorkingCopy; onDiscard: () => void }) {
  const { bar, revision } = wc
  if (wc.lockReason) {
    return <Alert tone={bar.status === 'suspended' ? 'danger' : 'info'} className="mb-6" title={wc.lockReason} />
  }
  if (bar.status === 'changes_requested') {
    return (
      <Alert tone="warning" className="mb-6" title="Nuestro equipo pidió algunos cambios">
        {bar.moderationNote && <p className="whitespace-pre-line">“{bar.moderationNote}”</p>}
        <p className="mt-1">Corrige lo indicado y vuelve a enviarlo desde el último paso.</p>
      </Alert>
    )
  }
  if (bar.status === 'rejected') {
    return (
      <Alert tone="danger" className="mb-6" title="La publicación no fue aprobada">
        {bar.moderationNote && <p className="whitespace-pre-line">Motivo: “{bar.moderationNote}”</p>}
        <p className="mt-1">Puedes corregir la información y enviarla de nuevo.</p>
      </Alert>
    )
  }
  if (bar.status === 'published') {
    if (revision?.status === 'changes_requested') {
      return (
        <Alert tone="warning" className="mb-6" title="Pedimos ajustes a tus cambios" action={<Button size="sm" variant="ghost" onClick={onDiscard}>Descartar cambios</Button>}>
          {revision.reviewComment && <p className="whitespace-pre-line">“{revision.reviewComment}”</p>}
          <p className="mt-1">La versión publicada sigue visible.</p>
        </Alert>
      )
    }
    return (
      <Alert
        tone="info"
        className="mb-6"
        title={revision ? 'Tienes cambios sin enviar' : 'Esta publicación está activa'}
        action={revision && <Button size="sm" variant="ghost" onClick={onDiscard}>Descartar cambios</Button>}
      >
        Lo que guardes se enviará como una nueva versión. La página actual seguirá visible hasta que la aprobemos.
      </Alert>
    )
  }
  return null
}

function BackLink() {
  return (
    <Link to="/panel/establecimientos" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
      <ChevronLeft className="size-4" /> Mis establecimientos
    </Link>
  )
}

function EditorFrame({ title, step, onStep, badge, actions, children }: { title: string; step?: number; onStep?: (s: number) => void; badge?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="pb-24">
      <BackLink />
      <PageHeader title={title} actions={<div className="flex items-center gap-3">{badge}{actions}</div>} />
      {step !== undefined && <Stepper steps={STEPS} current={step} onStepClick={onStep} maxStep={onStep ? STEPS.length - 1 : undefined} className="mb-8" />}
      {children}
    </div>
  )
}

function StepCard({ children }: { children: ReactNode }) {
  return <Card className="p-5 md:p-8">{children}</Card>
}

/** Barra de acciones fija abajo (zona del pulgar en móvil). */
function FooterBar({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:left-[272px]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 md:px-8">{children}</div>
    </div>
  )
}
