import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, Pencil } from 'lucide-react'
import { BarCard } from '@/components/bars/BarCard'
import { PRICE_RANGE_LABELS } from '@/components/bars/PriceRange'
import { Card, CardBody, buttonVariants } from '@/components/ui'
import { DAY_LABELS, type DayOfWeek } from '@/types/domain'
import type { BarFields, WorkingImage } from '../bars'
import type { StepProps } from './types'

const STEPS = ['Información general', 'Ubicación', 'Detalles', 'Fotografías']

interface ReviewProps extends Pick<StepProps, 'catalog'> {
  form: BarFields
  images: WorkingImage[]
  barId: string
  missing: { field: string; message: string; step: number }[]
  onEdit: (step: number) => void
  readOnly?: boolean
}

export function StepReview({ form, images, catalog, barId, missing, onEdit, readOnly }: ReviewProps) {
  const category = catalog.categories.find((c) => c.id === form.categoryId)
  const type = catalog.types.find((t) => t.id === form.typeId)
  const amenities = catalog.amenities.filter((a) => form.amenityIds.includes(a.id))

  const Section = ({ step, children }: { step: number; children: ReactNode }) => (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans text-base font-bold tracking-normal">{STEPS[step]}</h3>
          {!readOnly && <button type="button" onClick={() => onEdit(step)} className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"><Pencil className="size-3.5" /> Editar</button>}
        </div>
        <div className="text-[15px]">{children}</div>
      </CardBody>
    </Card>
  )
  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex gap-3 py-1"><dt className="w-36 shrink-0 text-fg-muted">{label}</dt><dd className="min-w-0 break-words">{value || <span className="text-fg-subtle">—</span>}</dd></div>
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        {!readOnly && (
          missing.length ? (
            <div className="rounded-2xl border border-warning-500/40 bg-warning-50 p-5">
              <p className="flex items-center gap-2 font-semibold"><AlertCircle className="size-5 text-warning-700" /> Te falta completar {missing.length} {missing.length === 1 ? 'dato' : 'datos'}</p>
              <ul className="mt-3 space-y-1.5 text-[15px]">
                {missing.map((m) => (
                  <li key={m.field}>
                    <button type="button" onClick={() => onEdit(m.step)} className="text-left underline-offset-4 hover:underline">{m.message}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-success-600/25 bg-success-50 p-5">
              <CheckCircle2 className="size-6 shrink-0 text-success-600" />
              <p className="font-semibold">Todo listo. Revisa la información y envíala a revisión.</p>
            </div>
          )
        )}

        <Section step={0}>
          <dl>
            <Row label="Nombre" value={form.name} />
            <Row label="Categoría" value={category?.name} />
            <Row label="Tipo" value={type?.name} />
          </dl>
          <p className="mt-2 line-clamp-4 whitespace-pre-line text-fg-muted">{form.description || 'Sin descripción'}</p>
        </Section>
        <Section step={1}>
          <dl>
            <Row label="Dirección" value={[form.address, form.neighborhood].filter(Boolean).join(', ')} />
            <Row label="Ciudad" value={[form.city, form.state].filter(Boolean).join(', ')} />
            <Row label="Código postal" value={form.postalCode} />
            <Row label="Mapa" value={form.latitude != null ? 'Ubicación marcada' : null} />
          </dl>
        </Section>
        <Section step={2}>
          <dl>
            <Row label="Precio" value={form.priceRange ? `${'$'.repeat(form.priceRange)} · ${PRICE_RANGE_LABELS[form.priceRange]}` : null} />
            <Row label="Teléfono" value={form.phone} />
            <Row label="Sitio web" value={form.website} />
            <Row label="Redes" value={[form.social.instagram && 'Instagram', form.social.facebook && 'Facebook', form.social.tiktok && 'TikTok'].filter(Boolean).join(', ')} />
            <Row label="Servicios" value={amenities.map((a) => a.name).join(', ')} />
          </dl>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {form.hours.map((h) => (
              <li key={h.dayOfWeek} className="flex justify-between gap-2 rounded-lg bg-subtle px-3 py-1.5">
                <span>{DAY_LABELS[h.dayOfWeek as DayOfWeek]}</span>
                <span className="tabular-nums text-fg-muted">{h.isClosed ? 'Cerrado' : `${h.opens ?? '--'} – ${h.closes ?? '--'}`}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section step={3}>
          {images.length ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((i) => <img key={i.id} src={i.thumbUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
            </div>
          ) : (
            <p className="text-fg-subtle">Sin fotos</p>
          )}
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <p className="text-sm font-semibold text-fg-muted">Así se verá en los resultados</p>
        <div className="pointer-events-none">
          <BarCard
            bar={{
              id: barId, slug: '', name: form.name || 'Tu bar', category: category?.name ?? 'Bar', neighborhood: form.neighborhood || form.city,
              city: form.city, priceRange: form.priceRange ?? 2, coverUrl: images[0]?.thumbUrl ?? null, imageUrls: images.map((i) => i.thumbUrl),
            }}
          />
        </div>
        <Link to={`/panel/establecimientos/${barId}/vista-previa`} className={buttonVariants({ variant: 'outline', block: true })}>
          <Eye /> Vista previa de la página
        </Link>
      </aside>
    </div>
  )
}
