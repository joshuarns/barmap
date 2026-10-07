import { lazy, Suspense, useCallback, useState } from 'react'
import { LocateFixed, MapPin, Search } from 'lucide-react'
import { Alert, Button, Field, Input, Skeleton } from '@/components/ui'
import { geocode, type GeocodeResult } from '../bars'
import { MX_STATES, type StepProps } from './types'

const LocationPicker = lazy(() => import('@/components/map/LocationPicker'))

export function StepLocation({ form, set, patch, errors }: StepProps) {
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const value = form.latitude != null && form.longitude != null ? { lat: form.latitude, lng: form.longitude } : null
  const onPick = useCallback((v: { lat: number; lng: number }) => patch({ latitude: v.lat, longitude: v.lng }), [patch])

  const search = async () => {
    const q = [form.address, form.neighborhood, form.city, form.state].filter(Boolean).join(', ')
    if (q.length < 6) return setGeoError('Escribe primero la dirección y la ciudad.')
    setSearching(true)
    setGeoError(null)
    try {
      const r = await geocode(q)
      setResults(r)
      if (!r.length) setGeoError('No encontramos esa dirección. Marca el punto directamente en el mapa.')
    } catch (e) {
      setGeoError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const choose = (r: GeocodeResult) => {
    patch({
      latitude: Math.round(r.latitude * 1e6) / 1e6,
      longitude: Math.round(r.longitude * 1e6) / 1e6,
      postalCode: form.postalCode || r.postalCode,
      neighborhood: form.neighborhood || r.neighborhood,
    })
    setResults(null)
    setFocusKey((k) => k + 1)
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return setGeoError('Tu navegador no permite obtener la ubicación.')
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onPick({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 })
        setFocusKey((k) => k + 1)
      },
      () => setGeoError('No pudimos obtener tu ubicación. Marca el punto en el mapa.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="País">
          <Input value="México" disabled />
        </Field>
        <Field label="Estado" error={errors.state}>
          <Input value={form.state} onChange={(e) => set('state', e.target.value)} list="mx-states" maxLength={80} autoComplete="address-level1" />
        </Field>
        <datalist id="mx-states">{MX_STATES.map((s) => <option key={s} value={s} />)}</datalist>
        <Field label="Ciudad o municipio" error={errors.city}>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} autoComplete="address-level2" />
        </Field>
        <Field label="Colonia" optional>
          <Input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} maxLength={80} />
        </Field>
        <Field label="Calle y número" error={errors.address} className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={160} autoComplete="street-address" placeholder="Ej. Durango 200, local 3" />
        </Field>
        <Field label="Código postal" optional error={errors.postalCode}>
          <Input value={form.postalCode} onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" autoComplete="postal-code" />
        </Field>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-fg">Ubicación en el mapa</p>
            <p className="text-[13px] text-fg-muted">Busca la dirección o toca el mapa. Arrastra el pin para ajustar la entrada exacta.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={search} loading={searching}><Search /> Ubicar dirección</Button>
            <Button variant="ghost" size="sm" onClick={useMyLocation}><LocateFixed /> Estoy en el bar</Button>
          </div>
        </div>

        {results && results.length > 0 && (
          <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button type="button" onClick={() => choose(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-subtle">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" /> {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {geoError && <Alert tone="warning" className="mb-3" title={geoError} />}

        <div className={`relative isolate z-0 aspect-[4/3] overflow-hidden rounded-2xl border sm:aspect-[16/9] ${errors.location ? 'border-danger-600' : 'border-line'}`}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <LocationPicker value={value} onChange={onPick} focusKey={focusKey} />
          </Suspense>
          {!value && (
            <span className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-md">
              Toca el mapa para marcar tu bar
            </span>
          )}
        </div>
        {errors.location ? (
          <p className="mt-2 text-[13px] font-medium text-danger-600">{errors.location}</p>
        ) : value ? (
          <p className="mt-2 text-[13px] tabular-nums text-fg-muted">Coordenadas: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>
        ) : null}
      </div>
    </div>
  )
}
