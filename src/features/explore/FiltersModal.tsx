import { useEffect, useState, type ReactNode } from 'react'
import { LocateFixed } from 'lucide-react'
import { Button, Chip, Modal, Switch } from '@/components/ui'
import { PriceRange } from '@/components/bars/PriceRange'
import { iconFor } from '@/components/icons/registry'
import { useCatalog } from '@/features/bars/queries'
import { RADIUS_OPTIONS, SORT_LABELS, type ExploreFilters } from '@/features/bars/filters'
import type { SortOption } from '@/types/api'
import type { GeoStatus } from '@/hooks/useGeolocation'

type PanelFilters = Pick<ExploreFilters, 'precio' | 'servicios' | 'abierto' | 'radio' | 'orden'>

interface FiltersModalProps {
  open: boolean
  onClose: () => void
  value: ExploreFilters
  onApply: (next: PanelFilters) => void
  geoStatus: GeoStatus
  onRequestLocation: () => void
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-6 first:pt-0 last:border-0">
      <legend className="mb-1 text-base font-bold text-fg">{title}</legend>
      {hint && <p className="mb-3 text-sm text-fg-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

export function FiltersModal({ open, onClose, value, onApply, geoStatus, onRequestLocation }: FiltersModalProps) {
  const catalog = useCatalog()
  const [draft, setDraft] = useState<PanelFilters>(value)
  const hasLocation = geoStatus === 'granted'

  // Al abrir, parte del estado actual de la URL.
  useEffect(() => {
    if (open) setDraft({ precio: value.precio, servicios: value.servicios, abierto: value.abierto, radio: value.radio, orden: value.orden })
  }, [open, value])

  const sorts: SortOption[] = [...(value.q ? (['relevance'] as const) : []), 'recommended', 'popular', 'distance', 'newest']

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filtros"
      className="md:max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDraft({ precio: [], servicios: [], abierto: false, radio: undefined, orden: undefined })}>
            Limpiar todo
          </Button>
          <Button variant="dark" onClick={() => onApply(draft)}>
            Ver resultados
          </Button>
        </>
      }
    >
      <Group title="Ordenar por">
        {sorts.map((s) => (
          <Chip
            key={s}
            selected={(draft.orden ?? (value.q ? 'relevance' : 'recommended')) === s}
            disabled={s === 'distance' && !hasLocation}
            className="disabled:opacity-40"
            onClick={() => setDraft({ ...draft, orden: s })}
          >
            {SORT_LABELS[s]}
          </Chip>
        ))}
      </Group>

      <Group title="Disponibilidad">
        <Switch label="Abierto ahora" checked={draft.abierto} onChange={(e) => setDraft({ ...draft, abierto: e.target.checked })} />
      </Group>

      <Group title="Rango de precio">
        {([1, 2, 3, 4] as const).map((p) => (
          <Chip key={p} selected={draft.precio.includes(p)} onClick={() => setDraft({ ...draft, precio: toggle(draft.precio, p).sort() })}>
            <PriceRange value={p} />
          </Chip>
        ))}
      </Group>

      <Group title="Distancia" hint={hasLocation ? 'Desde tu ubicación actual.' : 'Activa tu ubicación para filtrar por distancia.'}>
        {hasLocation ? (
          <>
            <Chip selected={!draft.radio} onClick={() => setDraft({ ...draft, radio: undefined })}>Cualquiera</Chip>
            {RADIUS_OPTIONS.map((r) => (
              <Chip key={r} selected={draft.radio === r} onClick={() => setDraft({ ...draft, radio: r })}>
                {r} km
              </Chip>
            ))}
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onRequestLocation} loading={geoStatus === 'requesting'}>
            <LocateFixed /> Usar mi ubicación
          </Button>
        )}
        {(geoStatus === 'denied' || geoStatus === 'unavailable') && (
          <p className="w-full text-sm text-fg-muted">No pudimos acceder a tu ubicación. Puedes buscar por ciudad o colonia.</p>
        )}
      </Group>

      <Group title="Servicios">
        {catalog.data?.amenities.map((a) => {
          const Icon = iconFor(a.icon)
          return (
            <Chip key={a.slug} selected={draft.servicios.includes(a.slug)} onClick={() => setDraft({ ...draft, servicios: toggle(draft.servicios, a.slug) })}>
              <Icon /> {a.name}
            </Chip>
          )
        })}
      </Group>
    </Modal>
  )
}
