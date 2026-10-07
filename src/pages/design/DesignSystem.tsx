import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Building2, CalendarClock, ClipboardCheck, Clock, Eye, Heart, Inbox, List, Map, MapPin, Plus,
  Search, SearchX, ShieldCheck, Store, Trash2, Upload, Users, Wifi, Car, Accessibility, Dog, Music, CreditCard,
} from 'lucide-react'
import {
  Alert, Avatar, Badge, Button, Card, CardBody, Checkbox, Chip, EmptyState, Field, Input, Modal,
  PUBLICATION_STATUS_META, PublicationStatusBadge, SegmentedControl, Select, Skeleton, Stepper, Switch,
  Tabs, Textarea, useToast, ApplicationStatusBadge, AccountStatusBadge, buttonVariants,
} from '@/components/ui'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { BarCard, BarCardSkeleton } from '@/components/bars/BarCard'
import { CategoryRail } from '@/components/bars/CategoryRail'
import { SEED_CATEGORIES } from '@/components/bars/categories'
import { HeroSearch } from '@/components/bars/HeroSearch'
import { LocationPrompt, type LocationState } from '@/components/bars/LocationPrompt'
import { PriceRange } from '@/components/bars/PriceRange'
import { StatCard } from '@/components/dashboard/StatCard'
import { PUBLICATION_STATUSES, type PublicationStatus } from '@/types/domain'
import { cn } from '@/lib/cn'
import { SAMPLE_BARS } from './sampleData'

const sections = [
  { id: 'principios', label: 'Principios' },
  { id: 'color', label: 'Color' },
  { id: 'tipografia', label: 'Tipografía' },
  { id: 'forma', label: 'Forma y elevación' },
  { id: 'botones', label: 'Botones' },
  { id: 'formularios', label: 'Formularios' },
  { id: 'estados', label: 'Estados' },
  { id: 'navegacion', label: 'Navegación' },
  { id: 'descubrimiento', label: 'Descubrimiento' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'paneles', label: 'Paneles' },
]

export default function DesignSystem() {
  return (
    <div className="container-page py-10 md:py-16">
      <header className="max-w-3xl">
        <Badge tone="brand" size="md">Etapa 1 · Sistema de diseño v0.1</Badge>
        <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] md:text-[56px]">
          El lenguaje visual de <span className="text-brand-600">Barmap</span>
        </h1>
        <p className="mt-4 text-lg text-fg-muted">
          Tokens, componentes y patrones compartidos por el sitio público, el panel de propietarios y la
          administración. Todo lo que ves aquí es código real y reutilizable de <code className="rounded bg-ink-100 px-1.5 py-0.5 text-[15px]">src/components</code>.
        </p>
      </header>

      <nav aria-label="Secciones" className="scrollbar-none sticky top-16 z-30 -mx-4 mt-10 flex gap-2 overflow-x-auto border-y border-line bg-canvas/95 px-4 py-3 backdrop-blur md:top-20 md:mx-0 md:rounded-full md:border md:px-3">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-fg-muted transition-colors hover:bg-ink-50 hover:text-fg">
            {s.label}
          </a>
        ))}
      </nav>

      <Principles />
      <Colors />
      <Typography />
      <ShapeElevation />
      <Buttons />
      <Forms />
      <Statuses />
      <Navigation />
      <Discovery />
      <Feedback />
      <Panels />
    </div>
  )
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-40 border-b border-line py-14 last:border-0 md:py-20">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-[28px] font-bold leading-tight md:text-[34px]">{title}</h2>
        {description && <p className="mt-2 text-[17px] text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-fg-subtle">{children}</p>
}

/* ------------------------------------------------------------------ */

function Principles() {
  const items = [
    { icon: Search, title: 'El buscador manda', text: 'Cada pantalla pública lleva a encontrar un lugar en dos toques. La búsqueda es siempre el elemento dominante.' },
    { icon: Eye, title: 'La foto vende el plan', text: 'Imágenes grandes, bordes suaves y texto mínimo en tarjetas. La interfaz se retira para que el lugar brille.' },
    { icon: MapPin, title: 'Pensado para la calle', text: 'Móvil primero: controles en la zona del pulgar, objetivos táctiles de 44 px y contraste AA para exteriores.' },
    { icon: ShieldCheck, title: 'Claridad en cada estado', text: 'Borrador, en revisión, publicado… cada estado tiene color, texto y siguiente paso. Nunca un estado mudo.' },
  ]
  return (
    <Section id="principios" title="Principios">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-6">
            <Icon className="size-6 text-brand-600" strokeWidth={1.75} />
            <h3 className="mt-4 font-sans text-base font-bold tracking-normal">{title}</h3>
            <p className="mt-1.5 text-[15px] text-fg-muted">{text}</p>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-center rounded-3xl border border-line bg-surface p-10">
          <Logo className="scale-150" />
        </div>
        <div className="flex items-center justify-center gap-6 rounded-3xl bg-ink-900 p-10">
          <Logo inverted className="scale-150" />
        </div>
      </div>
      <p className="mt-3 text-sm text-fg-muted">
        Isotipo: un pin de mapa con una copa de cóctel en negativo. Wordmark en minúsculas, Bricolage Grotesque ExtraBold.
      </p>
    </Section>
  )
}

const brandScale = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const
const brandHex: Record<string, string> = { 50: '#FFF4EF', 100: '#FFE5D9', 200: '#FFC7AD', 300: '#FDA079', 400: '#F47A4D', 500: '#E4572E', 600: '#C93D14', 700: '#A73110', 800: '#862913', 900: '#6D2514' }
const inkHex: Record<string, string> = { 50: '#F7F6F3', 100: '#EFEDE8', 200: '#E2DFD8', 300: '#C9C5BD', 400: '#A19DAA', 500: '#6B6778', 600: '#4D4A58', 700: '#35323F', 800: '#24212C', 900: '#17151F' }
const brandBg: Record<string, string> = { 50: 'bg-brand-50', 100: 'bg-brand-100', 200: 'bg-brand-200', 300: 'bg-brand-300', 400: 'bg-brand-400', 500: 'bg-brand-500', 600: 'bg-brand-600', 700: 'bg-brand-700', 800: 'bg-brand-800', 900: 'bg-brand-900' }
const inkBg: Record<string, string> = { 50: 'bg-ink-50', 100: 'bg-ink-100', 200: 'bg-ink-200', 300: 'bg-ink-300', 400: 'bg-ink-400', 500: 'bg-ink-500', 600: 'bg-ink-600', 700: 'bg-ink-700', 800: 'bg-ink-800', 900: 'bg-ink-900' }

function Colors() {
  return (
    <Section id="color" title="Color" description="Base clara y cálida, con un único acento: Mezcal. Se usa con moderación para acciones principales, selección y marca.">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="flex min-h-56 flex-col justify-between rounded-3xl bg-brand-600 p-7 text-white">
          <p className="text-sm font-semibold text-white/80">Acento principal</p>
          <div>
            <p className="font-display text-4xl font-bold">Mezcal</p>
            <p className="mt-1 font-mono text-sm text-white/80">brand-600 · #C93D14 · contraste 5.05:1 sobre blanco</p>
          </div>
        </div>
        <div className="grid grid-rows-2 gap-4">
          <div className="flex flex-col justify-between rounded-3xl bg-ink-900 p-6 text-white">
            <p className="text-sm font-semibold text-white/70">Texto y superficies nocturnas</p>
            <p className="font-mono text-sm">ink-900 · #17151F</p>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border border-line bg-subtle p-6">
            <p className="text-sm font-semibold text-fg-muted">Fondo sutil</p>
            <p className="font-mono text-sm">ink-50 · #F7F6F3</p>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-8">
        {[
          { name: 'brand', hex: brandHex, bg: brandBg },
          { name: 'ink', hex: inkHex, bg: inkBg },
        ].map((scale) => (
          <div key={scale.name}>
            <Label>{scale.name}</Label>
            <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
              {brandScale.map((step) => (
                <div key={step}>
                  <div className={cn('h-14 rounded-xl ring-1 ring-inset ring-black/5', scale.bg[step])} />
                  <p className="mt-1.5 text-xs font-semibold">{step}</p>
                  <p className="font-mono text-[11px] text-fg-muted">{scale.hex[step]}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div>
          <Label>Semánticos</Label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { name: 'success', cls: 'bg-success-600', soft: 'bg-success-50', use: 'Publicado, aprobado' },
              { name: 'warning', cls: 'bg-warning-500', soft: 'bg-warning-50', use: 'Pendiente, requiere cambios' },
              { name: 'danger', cls: 'bg-danger-600', soft: 'bg-danger-50', use: 'Rechazado, errores' },
              { name: 'info', cls: 'bg-info-600', soft: 'bg-info-50', use: 'En revisión, avisos' },
            ].map((c) => (
              <div key={c.name} className="overflow-hidden rounded-2xl border border-line">
                <div className="flex h-16">
                  <div className={cn('flex-1', c.cls)} />
                  <div className={cn('flex-1', c.soft)} />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-fg-muted">{c.use}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

function Typography() {
  const scale = [
    { name: 'Display', cls: 'font-display text-[44px] md:text-[56px] font-extrabold leading-[1.05] tracking-[-0.03em]', sample: 'Tu próximo bar favorito' },
    { name: 'H1', cls: 'font-display text-[32px] md:text-[40px] font-bold leading-tight tracking-[-0.02em]', sample: 'Bares en Roma Norte' },
    { name: 'H2', cls: 'font-display text-[26px] md:text-[30px] font-bold leading-tight tracking-[-0.02em]', sample: 'Populares esta semana' },
    { name: 'H3', cls: 'text-lg font-bold', sample: 'Horarios y ubicación' },
    { name: 'Cuerpo', cls: 'text-base', sample: 'Coctelería de autor en una terraza con vista a la ciudad, ideal para empezar la noche.' },
    { name: 'Secundario', cls: 'text-[15px] text-fg-muted', sample: 'Coctelería · Roma Norte · a 650 m' },
    { name: 'Etiqueta', cls: 'text-xs font-bold uppercase tracking-[0.08em] text-fg-subtle', sample: 'Servicios y amenidades' },
  ]
  return (
    <Section id="tipografia" title="Tipografía" description="Bricolage Grotesque aporta carácter en titulares; Plus Jakarta Sans da una lectura limpia en interfaz y textos largos.">
      <div className="divide-y divide-line rounded-3xl border border-line bg-surface">
        {scale.map((t) => (
          <div key={t.name} className="grid gap-2 p-5 md:grid-cols-[140px_1fr] md:items-baseline md:p-6">
            <p className="text-sm font-semibold text-fg-subtle">{t.name}</p>
            <p className={t.cls}>{t.sample}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function ShapeElevation() {
  return (
    <Section id="forma" title="Forma y elevación" description="Bordes generosos y sombras apenas perceptibles. La elevación comunica interacción, no decoración.">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <Label>Radios</Label>
          <div className="flex flex-wrap items-end gap-4">
            {[
              { n: 'sm · 8', c: 'rounded-lg' },
              { n: 'md · 12', c: 'rounded-xl' },
              { n: 'lg · 16', c: 'rounded-2xl' },
              { n: 'xl · 24', c: 'rounded-3xl' },
              { n: 'full', c: 'rounded-full' },
            ].map((r) => (
              <div key={r.n} className="text-center">
                <div className={cn('size-16 border-2 border-ink-900 bg-brand-50', r.c)} />
                <p className="mt-2 text-xs font-semibold">{r.n}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Sombras</Label>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg'].map((s) => (
              <div key={s} className={cn('flex h-20 items-center justify-center rounded-2xl bg-surface text-xs font-semibold', s)}>
                {s.replace('shadow-', '')}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8">
        <Label>Iconografía · Lucide, trazo 1.75–2</Label>
        <div className="flex flex-wrap gap-3">
          {[Search, MapPin, Heart, Clock, Wifi, Car, Accessibility, Dog, Music, CreditCard, Store, Users, ShieldCheck, CalendarClock].map((Icon, i) => (
            <span key={i} className="flex size-12 items-center justify-center rounded-xl border border-line bg-surface">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
          ))}
        </div>
      </div>
    </Section>
  )
}

function Buttons() {
  const [loading, setLoading] = useState(false)
  return (
    <Section id="botones" title="Botones" description="Una sola acción primaria por vista. Mezcal para la acción principal; tinta oscura para acciones fuertes secundarias.">
      <div className="space-y-8">
        <div>
          <Label>Variantes</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Enviar a revisión</Button>
            <Button variant="dark">Guardar borrador</Button>
            <Button variant="outline">Cancelar</Button>
            <Button variant="subtle">Filtros</Button>
            <Button variant="ghost">Ver más</Button>
            <Button variant="danger">Rechazar</Button>
            <Button variant="link">Cómo funciona</Button>
          </div>
        </div>
        <div>
          <Label>Tamaños e iconos</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm"><Plus /> Agregar</Button>
            <Button size="md"><Plus /> Agregar bar</Button>
            <Button size="lg">Registra tu bar <ArrowRight /></Button>
            <Button size="icon" variant="outline" aria-label="Favorito"><Heart /></Button>
            <Button size="icon-sm" variant="subtle" aria-label="Eliminar"><Trash2 /></Button>
          </div>
        </div>
        <div>
          <Label>Estados</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1600) }}>
              {loading ? 'Enviando' : 'Probar carga'}
            </Button>
            <Button disabled>Deshabilitado</Button>
            <Button variant="outline" disabled>Deshabilitado</Button>
          </div>
          <p className="mt-3 text-sm text-fg-muted">Pulsa "Probar carga": el ancho se mantiene durante la carga para evitar saltos.</p>
        </div>
      </div>
    </Section>
  )
}

const AMENITIES = [
  { slug: 'terraza', label: 'Terraza' },
  { slug: 'musica', label: 'Música en vivo', icon: Music },
  { slug: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { slug: 'pet', label: 'Pet friendly', icon: Dog },
  { slug: 'estacionamiento', label: 'Estacionamiento', icon: Car },
  { slug: 'accesible', label: 'Accesible', icon: Accessibility },
  { slug: 'tarjeta', label: 'Acepta tarjeta', icon: CreditCard },
]

function Forms() {
  const [amenities, setAmenities] = useState<string[]>(['wifi', 'tarjeta'])
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const nameError = touched && name.trim().length < 3 ? 'Escribe al menos 3 caracteres.' : undefined

  return (
    <Section id="formularios" title="Formularios" description="Etiquetas siempre visibles, ayudas cortas y errores que explican cómo resolver el problema. Campos de 48 px para uso táctil.">
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-5">
            <Field label="Nombre del bar" hint="Así aparecerá en el buscador." error={nameError}>
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} placeholder="Ej. La Azotea" maxLength={80} />
            </Field>
            <Field label="Categoría">
              <Select defaultValue="">
                <option value="" disabled>Selecciona una categoría</option>
                {SEED_CATEGORIES.slice(1).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Descripción" optional hint="Máximo 600 caracteres.">
              <Textarea placeholder="Cuéntale a la gente qué hace especial a tu bar…" />
            </Field>
            <Field label="Correo de contacto" error="Este correo no parece válido. Revisa que incluya @ y un dominio.">
              <Input defaultValue="contacto@bar" type="email" />
            </Field>
            <Field label="Buscar">
              <Input leading={<Search />} placeholder="Nombre, colonia o ciudad" />
            </Field>
          </CardBody>
        </Card>
        <div className="space-y-8">
          <div>
            <Label>Chips de filtro · servicios</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(({ slug, label, icon: Icon }) => {
                const on = amenities.includes(slug)
                return (
                  <Chip key={slug} selected={on} onClick={() => setAmenities((xs) => (on ? xs.filter((x) => x !== slug) : [...xs, slug]))}>
                    {Icon && <Icon />}
                    {label}
                  </Chip>
                )
              })}
            </div>
          </div>
          <div>
            <Label>Casillas e interruptores</Label>
            <div className="space-y-4">
              <Checkbox label="Abierto ahora" description="Solo lugares abiertos en este momento." defaultChecked />
              <Checkbox label="Acepto los términos de publicación" />
              <Switch label="Cerrado este día" />
            </div>
          </div>
          <div>
            <Label>Rango de precio</Label>
            <div className="flex gap-2">
              {([1, 2, 3, 4] as const).map((p) => (
                <Chip key={p} selected={p === 2}><PriceRange value={p} /></Chip>
              ))}
            </div>
          </div>
          <div>
            <Label>Carga de fotografías</Label>
            <button type="button" className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-line-strong bg-subtle px-6 py-10 text-center transition-colors hover:border-ink-900">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-surface shadow-xs"><Upload className="size-5" /></span>
              <span className="mt-3 font-semibold">Arrastra tus fotos o haz clic para elegir</span>
              <span className="mt-1 text-sm text-fg-muted">JPG, PNG, WebP o HEIC · máx. 8 MB cada una · mínimo 1000×600 px</span>
            </button>
          </div>
        </div>
      </div>
    </Section>
  )
}

const FLOW: { from: PublicationStatus; to: PublicationStatus[]; who: string }[] = [
  { from: 'draft', to: ['pending_review'], who: 'Propietario envía' },
  { from: 'pending_review', to: ['published', 'changes_requested', 'rejected'], who: 'Admin decide' },
  { from: 'changes_requested', to: ['pending_review'], who: 'Propietario corrige y reenvía' },
  { from: 'published', to: ['suspended'], who: 'Admin retira' },
]

function Statuses() {
  return (
    <Section id="estados" title="Estados y moderación" description="Cada estado del flujo de aprobación tiene un color, una etiqueta y un siguiente paso claro. Los estados siempre llevan texto, nunca solo color.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PUBLICATION_STATUSES.map((s) => (
          <Card key={s} className="p-5">
            <div className="flex items-center justify-between">
              <PublicationStatusBadge status={s} size="md" />
              <code className="text-xs text-fg-subtle">{s}</code>
            </div>
            <p className="mt-3 text-[15px] text-fg-muted">{PUBLICATION_STATUS_META[s].description}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-line bg-subtle p-6">
        <Label>Flujo de publicación</Label>
        <ul className="space-y-3">
          {FLOW.map((f) => (
            <li key={f.from} className="flex flex-wrap items-center gap-2.5">
              <PublicationStatusBadge status={f.from} />
              <ArrowRight className="size-4 text-fg-subtle" />
              {f.to.map((t) => <PublicationStatusBadge key={t} status={t} />)}
              <span className="text-sm text-fg-muted">— {f.who}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-fg-muted">
          Editar un bar publicado crea una <strong className="text-fg">revisión pendiente</strong>; la versión aprobada sigue visible hasta que el admin apruebe los cambios.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-8">
        <div>
          <Label>Solicitud de propietario</Label>
          <div className="flex gap-2"><ApplicationStatusBadge status="pending" /><ApplicationStatusBadge status="approved" /><ApplicationStatusBadge status="rejected" /></div>
        </div>
        <div>
          <Label>Cuenta</Label>
          <div className="flex gap-2"><AccountStatusBadge status="active" /><AccountStatusBadge status="suspended" /></div>
        </div>
      </div>
    </Section>
  )
}

const STEPS = ['Información', 'Ubicación', 'Detalles', 'Fotos', 'Revisión']

function Navigation() {
  const [view, setView] = useState<'lista' | 'mapa'>('lista')
  const [tab, setTab] = useState('pending')
  const [step, setStep] = useState(1)
  return (
    <Section id="navegacion" title="Navegación" description="Controles para alternar vistas, filtrar listados y avanzar por formularios largos.">
      <div className="space-y-10">
        <div>
          <Label>Control segmentado · lista / mapa</Label>
          <SegmentedControl label="Vista de resultados" value={view} onChange={setView} options={[{ value: 'lista', label: 'Lista', icon: List }, { value: 'mapa', label: 'Mapa', icon: Map }]} />
        </div>
        <div>
          <Label>Pestañas · cola de moderación</Label>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Pendientes', count: 12 }, { value: 'changes', label: 'Con cambios', count: 3 }, { value: 'published', label: 'Publicados' }, { value: 'rejected', label: 'Rechazados' }]} />
        </div>
        <div>
          <Label>Stepper · alta de establecimiento</Label>
          <Card className="p-5 md:p-6">
            <Stepper steps={STEPS} current={step} onStepClick={setStep} />
            <div className="mt-6 flex justify-between border-t border-line pt-5">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Atrás</Button>
              <Button variant="dark" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>Continuar</Button>
            </div>
          </Card>
        </div>
      </div>
    </Section>
  )
}

function Discovery() {
  const [category, setCategory] = useState('todos')
  const [favs, setFavs] = useState<string[]>(['s2'])
  const [loading, setLoading] = useState(false)
  const [loc, setLoc] = useState<LocationState>('idle')
  const toast = useToast()

  const requestLocation = () => {
    if (!('geolocation' in navigator)) return setLoc('denied')
    setLoc('requesting')
    navigator.geolocation.getCurrentPosition(
      () => { setLoc('granted'); toast({ tone: 'success', title: 'Ubicación activada', description: 'Ordenaremos los bares por cercanía.' }) },
      () => setLoc('denied'),
      { timeout: 10000 },
    )
  }

  return (
    <Section id="descubrimiento" title="Descubrimiento" description="Los componentes del lado público: buscador, categorías y tarjetas. Datos de ejemplo, solo para esta guía.">
      <div className="relative overflow-hidden rounded-[2rem] bg-subtle px-4 py-12 md:px-12 md:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-100 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center">
          <h3 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-5xl">¿A dónde vamos esta noche?</h3>
          <p className="mt-3 text-[17px] text-fg-muted">Bares revisados por personas, cerca de ti.</p>
          <HeroSearch
            className="mt-8 text-left"
            onSearch={(q) => toast({ tone: 'info', title: 'Búsqueda de prueba', description: `"${q.q || 'cualquier bar'}" en ${q.where || 'cualquier lugar'}. Se conecta en la Etapa 2.` })}
            onUseLocation={requestLocation}
          />
        </div>
      </div>

      <div className="mt-10">
        <CategoryRail categories={SEED_CATEGORIES} value={category} onChange={setCategory} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h3 className="font-display text-2xl font-bold">Populares cerca de ti</h3>
        <Button variant="subtle" size="sm" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500) }}>Simular carga</Button>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <BarCardSkeleton key={i} />)
          : SAMPLE_BARS.map((bar) => (
              <BarCard
                key={bar.id}
                bar={bar}
                isFavorite={favs.includes(bar.id)}
                onToggleFavorite={(b) => {
                  const on = favs.includes(b.id)
                  setFavs((xs) => (on ? xs.filter((x) => x !== b.id) : [...xs, b.id]))
                  toast({ tone: 'success', title: on ? 'Quitado de favoritos' : 'Guardado en favoritos', description: b.name })
                }}
              />
            ))}
      </div>

      <div className="mt-10">
        <Label>Permiso de ubicación · no bloqueante</Label>
        <LocationPrompt state={loc} onRequest={requestLocation} />
        {loc === 'granted' && <Alert tone="success" title="Ubicación activa">Los resultados se ordenarán por distancia.</Alert>}
      </div>
    </Section>
  )
}

function Feedback() {
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  return (
    <Section id="feedback" title="Feedback" description="Cada acción responde: avisos breves, confirmaciones solo para lo irreversible, estados vacíos que invitan a actuar y skeletons en cada carga.">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Label>Alertas</Label>
          <Alert tone="info" title="Tu solicitud está en revisión">Te avisaremos por correo en un plazo de 24 a 48 h hábiles.</Alert>
          <Alert tone="warning" title="Se solicitaron cambios en «La Azotea»" action={<Button size="sm" variant="dark">Revisar comentarios</Button>}>
            Las fotos no muestran el interior del establecimiento.
          </Alert>
          <Alert tone="success" title="Publicación aprobada">«Salón Verde» ya es visible en Barmap.</Alert>
          <Alert tone="danger" title="No pudimos guardar tus fotos">Dos imágenes superan los 8 MB. Reduce su tamaño e inténtalo de nuevo.</Alert>
        </div>
        <div className="space-y-8">
          <div>
            <Label>Avisos (toasts) y confirmación</Label>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => toast({ tone: 'success', title: 'Borrador guardado', description: 'Puedes continuar cuando quieras.' })}>Aviso de éxito</Button>
              <Button variant="outline" onClick={() => toast({ tone: 'error', title: 'No se pudo guardar', description: 'Revisa tu conexión e inténtalo de nuevo.' })}>Aviso de error</Button>
              <Button variant="danger" onClick={() => setConfirm(true)}>Rechazar publicación</Button>
            </div>
          </div>
          <div>
            <Label>Skeleton</Label>
            <Card className="flex items-center gap-4 p-5">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3.5 w-1/3" /></div>
              <Skeleton className="h-7 w-24 rounded-full" />
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card><EmptyState icon={SearchX} title="Sin resultados" description="No encontramos bares con esos filtros. Prueba ampliar la distancia o quitar algún servicio." action={<Button variant="outline" size="sm">Limpiar filtros</Button>} /></Card>
        <Card><EmptyState icon={Store} title="Aún no tienes bares" description="Registra tu primer establecimiento; te guiamos paso a paso." action={<Button size="sm"><Plus /> Agregar bar</Button>} /></Card>
        <Card><EmptyState icon={Inbox} title="Bandeja al día" description="No hay publicaciones esperando revisión. ¡Buen trabajo!" /></Card>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Rechazar «La Azotea»?"
        description="El propietario recibirá una notificación con el motivo. Podrá corregir y volver a enviar."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { setConfirm(false); toast({ tone: 'success', title: 'Publicación rechazada', description: 'Se registró en el historial de moderación.' }) }}>Rechazar</Button>
          </>
        }
      >
        <Field label="Motivo del rechazo" hint="El propietario verá este mensaje.">
          <Textarea rows={3} placeholder="Ej. Las fotografías no corresponden al establecimiento." />
        </Field>
      </Modal>
    </Section>
  )
}

function Panels() {
  const rows = [
    { name: 'La Azotea', owner: 'Mariana Ortega', city: 'CDMX', date: '21 sept 2026', status: 'pending_review' as const, img: SAMPLE_BARS[0].coverUrl },
    { name: 'Mezcalería El Tigre', owner: 'Luis Herrera', city: 'CDMX', date: '20 sept 2026', status: 'changes_requested' as const, img: SAMPLE_BARS[1].coverUrl },
    { name: 'Lúpulo Norte', owner: 'Ana Ruiz', city: 'Monterrey', date: '18 sept 2026', status: 'published' as const, img: SAMPLE_BARS[2].coverUrl },
  ]
  return (
    <Section id="paneles" title="Paneles" description="El panel de propietarios y la administración comparten componentes. El admin se distingue por su barra lateral oscura.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Solicitudes pendientes" value={8} icon={Users} tone="warning" hint="3 desde ayer" />
        <StatCard label="Publicaciones en revisión" value={12} icon={ClipboardCheck} tone="info" />
        <StatCard label="Bares publicados" value={1284} icon={Building2} tone="success" />
        <StatCard label="Visitas este mes" value={48210} icon={Eye} tone="brand" />
      </div>

      <div className="mt-8">
        <Label>Tabla responsive · se convierte en tarjetas en móvil</Label>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-line bg-subtle text-xs font-bold uppercase tracking-[0.06em] text-fg-subtle md:table-header-group">
              <tr><th className="px-5 py-3">Establecimiento</th><th className="px-5 py-3">Propietario</th><th className="px-5 py-3">Ciudad</th><th className="px-5 py-3">Enviado</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3"><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-subtle md:table-row md:p-0">
                  <td className="row-span-2 md:px-5 md:py-3.5">
                    <div className="flex items-center gap-3">
                      <img src={r.img ?? undefined} alt="" className="size-12 rounded-xl object-cover" />
                      <span className="hidden font-semibold md:inline">{r.name}</span>
                    </div>
                  </td>
                  <td className="font-semibold md:hidden">{r.name}</td>
                  <td className="col-start-2 text-sm text-fg-muted md:px-5 md:py-3.5 md:text-[15px] md:text-fg">
                    <span className="flex items-center gap-2"><Avatar name={r.owner} size="sm" className="hidden md:inline-flex" />{r.owner}</span>
                  </td>
                  <td className="hidden md:table-cell md:px-5 md:py-3.5">{r.city}</td>
                  <td className="hidden text-fg-muted md:table-cell md:px-5 md:py-3.5">{r.date}</td>
                  <td className="col-start-3 row-start-1 md:px-5 md:py-3.5"><PublicationStatusBadge status={r.status} /></td>
                  <td className="col-start-3 row-start-2 text-right md:px-5 md:py-3.5"><Button size="sm" variant="outline">Revisar</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link to="/panel" className="group rounded-3xl border border-line bg-surface p-6 transition-shadow hover:shadow-md">
          <LogoMark className="text-brand-600" />
          <p className="mt-4 font-bold">Estructura del panel de propietarios</p>
          <p className="mt-1 text-[15px] text-fg-muted">Navegación lateral, cajón en móvil y encabezados de página.</p>
          <span className={cn(buttonVariants({ variant: 'link' }), 'mt-3')}>Abrir /panel <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link to="/admin" className="group rounded-3xl bg-ink-900 p-6 text-white transition-shadow hover:shadow-lg">
          <LogoMark className="text-brand-400" />
          <p className="mt-4 font-bold">Estructura del panel de administración</p>
          <p className="mt-1 text-[15px] text-ink-300">Mismo sistema, identidad oscura para distinguir el contexto.</p>
          <span className="mt-3 inline-flex items-center gap-2 font-semibold text-brand-300">Abrir /admin <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
      </div>
    </Section>
  )
}
