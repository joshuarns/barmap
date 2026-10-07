import { Copy } from 'lucide-react'
import { Alert, Button, Chip, Field, Input, Switch } from '@/components/ui'
import { PriceRange, PRICE_RANGE_LABELS } from '@/components/bars/PriceRange'
import { iconFor } from '@/components/icons/registry'
import { DAY_LABELS, type DayOfWeek, type PriceRange as Price } from '@/types/domain'
import { cn } from '@/lib/cn'
import type { HourInput } from '../bars'
import type { StepProps } from './types'

export function StepDetails({ form, set, errors, catalog }: StepProps) {
  const updateDay = (day: number, p: Partial<HourInput>) =>
    set('hours', form.hours.map((h) => (h.dayOfWeek === day ? { ...h, ...p } : h)))

  const firstOpen = form.hours.find((h) => !h.isClosed && h.opens && h.closes)
  const copyToAll = () =>
    firstOpen && set('hours', form.hours.map((h) => (h.isClosed ? h : { ...h, opens: firstOpen.opens, closes: firstOpen.closes })))

  const toggleAmenity = (id: number) =>
    set('amenityIds', form.amenityIds.includes(id) ? form.amenityIds.filter((a) => a !== id) : [...form.amenityIds, id].sort((a, b) => a - b))

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-sans text-base font-bold tracking-normal">Horarios</h3>
            <p className="text-[13px] text-fg-muted">Si cierras después de medianoche, pon la hora de cierre del día siguiente (ej. 18:00 – 02:00).</p>
          </div>
          {firstOpen && <Button variant="ghost" size="sm" onClick={copyToAll}><Copy /> Copiar a todos</Button>}
        </div>
        <div className={cn('divide-y divide-line rounded-2xl border', errors.hours ? 'border-danger-600' : 'border-line')}>
          {form.hours.map((h) => {
            const overnight = !h.isClosed && h.opens && h.closes && h.closes <= h.opens
            return (
              <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="w-24 font-medium">{DAY_LABELS[h.dayOfWeek as DayOfWeek]}</span>
                <Switch
                  aria-label={`Abierto el ${DAY_LABELS[h.dayOfWeek as DayOfWeek].toLowerCase()}`}
                  label={h.isClosed ? 'Cerrado' : 'Abierto'}
                  checked={!h.isClosed}
                  onChange={(e) => updateDay(h.dayOfWeek, e.target.checked ? { isClosed: false, opens: h.opens ?? '18:00', closes: h.closes ?? '02:00' } : { isClosed: true })}
                />
                {!h.isClosed && (
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <input
                      type="time"
                      aria-label={`Apertura ${DAY_LABELS[h.dayOfWeek as DayOfWeek]}`}
                      value={h.opens ?? ''}
                      onChange={(e) => updateDay(h.dayOfWeek, { opens: e.target.value || null })}
                      className="h-10 rounded-lg border border-line-strong px-2.5 text-[15px] tabular-nums focus:border-ink-900 focus:outline-none"
                    />
                    <span className="text-fg-muted">a</span>
                    <input
                      type="time"
                      aria-label={`Cierre ${DAY_LABELS[h.dayOfWeek as DayOfWeek]}`}
                      value={h.closes ?? ''}
                      onChange={(e) => updateDay(h.dayOfWeek, { closes: e.target.value || null })}
                      className="h-10 rounded-lg border border-line-strong px-2.5 text-[15px] tabular-nums focus:border-ink-900 focus:outline-none"
                    />
                    {overnight && <span className="text-xs text-fg-subtle">día siguiente</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {errors.hours && <p className="mt-2 text-[13px] font-medium text-danger-600">{errors.hours}</p>}
      </section>

      <section>
        <h3 className="mb-3 font-sans text-base font-bold tracking-normal">Rango de precios</h3>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4] as Price[]).map((p) => (
            <Chip key={p} selected={form.priceRange === p} onClick={() => set('priceRange', p)}>
              <PriceRange value={p} className={form.priceRange === p ? '[&_span]:!text-white' : ''} /> {PRICE_RANGE_LABELS[p]}
            </Chip>
          ))}
        </div>
        {errors.priceRange && <p className="mt-2 text-[13px] font-medium text-danger-600">{errors.priceRange}</p>}
      </section>

      <section>
        <h3 className="mb-1 font-sans text-base font-bold tracking-normal">Contacto</h3>
        <p className="mb-4 text-[13px] text-fg-muted">Agrega al menos uno. Se mostrarán públicamente en la página de tu bar.</p>
        {errors.contact && <Alert tone="danger" className="mb-4" title={errors.contact} />}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Teléfono" optional error={errors.phone}>
            <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={25} placeholder="55 1234 5678" />
          </Field>
          <Field label="Sitio web" optional error={errors.website}>
            <Input value={form.website} onChange={(e) => set('website', e.target.value)} maxLength={300} inputMode="url" placeholder="tubar.com" />
          </Field>
          <Field label="Instagram" optional>
            <Input value={form.social.instagram} onChange={(e) => set('social', { ...form.social, instagram: e.target.value })} maxLength={200} placeholder="@tubar" />
          </Field>
          <Field label="Facebook" optional>
            <Input value={form.social.facebook} onChange={(e) => set('social', { ...form.social, facebook: e.target.value })} maxLength={200} placeholder="facebook.com/tubar" />
          </Field>
          <Field label="TikTok" optional>
            <Input value={form.social.tiktok} onChange={(e) => set('social', { ...form.social, tiktok: e.target.value })} maxLength={200} placeholder="@tubar" />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-sans text-base font-bold tracking-normal">Servicios y amenidades</h3>
        <div className="flex flex-wrap gap-2">
          {catalog.amenities.map((a) => {
            const Icon = iconFor(a.icon)
            return (
              <Chip key={a.id} selected={form.amenityIds.includes(a.id)} onClick={() => toggleAmenity(a.id)}>
                <Icon /> {a.name}
              </Chip>
            )
          })}
        </div>
      </section>
    </div>
  )
}
