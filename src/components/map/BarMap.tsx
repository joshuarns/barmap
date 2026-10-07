import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { Search, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { BarSummary } from '@/types/api'
import { PriceRange } from '@/components/bars/PriceRange'
import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/format'
import { TILE_ATTRIBUTION, TILE_URL, escapeHtml } from './tiles'

export interface BarMapProps {
  bars: BarSummary[]
  hoveredId?: string | null
  selectedId?: string | null
  onSelect: (id: string | null) => void
  /** Si se pasa, aparece "Buscar en esta zona" al mover el mapa. */
  onSearchArea?: (bbox: [number, number, number, number]) => void
  userLocation?: { lat: number; lng: number }
  className?: string
}

type Located = BarSummary & { latitude: number; longitude: number }

const MEXICO_CENTER: L.LatLngExpression = [19.4326, -99.1332]
/** Con zoom >= 14 los pines muestran el nombre; más lejos, un punto compacto. */
const LABEL_ZOOM = 14
/** Distancia en píxeles bajo la cual los marcadores se agrupan. */
const CLUSTER_PX = 36

function pinIcon(name: string, state: 'default' | 'hover' | 'selected', compact: boolean) {
  const label = name.length > 22 ? `${name.slice(0, 20)}…` : name
  const html =
    compact && state === 'default'
      ? `<span class="bm-dot" title="${escapeHtml(name)}"></span>`
      : `<span class="bm-pin bm-pin--${state}">${escapeHtml(label)}</span>`
  return L.divIcon({ className: 'bm-pin-wrap', html, iconSize: [0, 0], iconAnchor: [0, 0] })
}

function clusterIcon(count: number, active: boolean) {
  return L.divIcon({
    className: 'bm-pin-wrap',
    html: `<span class="bm-cluster${active ? ' bm-cluster--active' : ''}">${count}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Agrupación codiciosa por proximidad en píxeles al zoom actual (suficiente para cientos de bares). */
function cluster(map: L.Map, bars: Located[], zoom: number) {
  const groups: { center: L.Point; members: Located[] }[] = []
  for (const b of bars) {
    const p = map.project([b.latitude, b.longitude], zoom)
    const g = groups.find((x) => x.center.distanceTo(p) < CLUSTER_PX)
    if (g) g.members.push(b)
    else groups.push({ center: p, members: [b] })
  }
  return groups.map((g) => g.members)
}

/** Ajusta el encuadre cuando cambia el conjunto de resultados (no en cada hover). */
function FitBounds({ bars, userLocation, programmatic }: { bars: Located[]; userLocation?: BarMapProps['userLocation']; programmatic: RefObject<boolean> }) {
  const map = useMap()
  const key = bars.map((b) => b.id).join(',')
  useEffect(() => {
    const pts = bars.map((b) => [b.latitude, b.longitude] as [number, number])
    if (userLocation && pts.length === 0) pts.push([userLocation.lat, userLocation.lng])
    if (!pts.length) return
    programmatic.current = true
    if (pts.length === 1) map.setView(pts[0], 15)
    else map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 })
    // Solo al cambiar el conjunto de ids: no re-encuadrar en cada render.
  }, [key, map])
  return null
}

interface MarkersProps {
  bars: Located[]
  hoveredId?: string | null
  selectedId?: string | null
  onSelect: (id: string | null) => void
  onMoved: () => void
  programmatic: RefObject<boolean>
}

function Markers({ bars, hoveredId, selectedId, onSelect, onMoved, programmatic }: MarkersProps) {
  const [zoom, setZoom] = useState<number | null>(null)
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => {
      setZoom(map.getZoom())
      if (programmatic.current) programmatic.current = false
      else onMoved()
    },
    click: () => onSelect(null),
  })
  const z = zoom ?? map.getZoom()
  const groups = useMemo(() => cluster(map, bars, z), [map, bars, z])

  return groups.map((members) => {
    if (members.length > 1) {
      const active = members.some((m) => m.id === hoveredId || m.id === selectedId)
      const lat = members.reduce((a, m) => a + m.latitude, 0) / members.length
      const lng = members.reduce((a, m) => a + m.longitude, 0) / members.length
      return (
        <Marker
          key={`c-${members.map((m) => m.id).join('-')}`}
          position={[lat, lng]}
          icon={clusterIcon(members.length, active)}
          zIndexOffset={500}
          title={`${members.length} bares`}
          eventHandlers={{
            click: () => {
              const bounds = L.latLngBounds(members.map((m) => [m.latitude, m.longitude] as [number, number]))
              map.flyToBounds(bounds, { padding: [64, 64], maxZoom: 17, duration: 0.6 })
            },
          }}
        />
      )
    }
    const b = members[0]
    const state = b.id === selectedId ? 'selected' : b.id === hoveredId ? 'hover' : 'default'
    return (
      <Marker
        key={b.id}
        position={[b.latitude, b.longitude]}
        icon={pinIcon(b.name, state, z < LABEL_ZOOM)}
        zIndexOffset={state === 'default' ? 0 : 1000}
        title={b.name}
        keyboard
        eventHandlers={{ click: () => onSelect(b.id) }}
      />
    )
  })
}

export default function BarMap({ bars, hoveredId, selectedId, onSelect, onSearchArea, userLocation, className }: BarMapProps) {
  const programmatic = useRef(false)
  const mapRef = useRef<L.Map | null>(null)
  const [moved, setMoved] = useState(false)
  const located = useMemo(() => bars.filter((b): b is Located => b.latitude != null && b.longitude != null), [bars])
  const selected = located.find((b) => b.id === selectedId)

  useEffect(() => setMoved(false), [bars])

  return (
    <div className={cn('relative isolate z-0 overflow-hidden bg-ink-100', className)}>
      <MapContainer
        ref={mapRef}
        center={userLocation ? [userLocation.lat, userLocation.lng] : MEXICO_CENTER}
        zoom={12}
        zoomControl={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={20} />
        <ZoomControl position="bottomright" />
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2F5FD6', fillOpacity: 1 }}
          />
        )}
        <Markers
          bars={located}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onSelect={onSelect}
          onMoved={() => setMoved(true)}
          programmatic={programmatic}
        />
        {/* Después de <Markers>: sus eventos deben estar registrados antes del primer encuadre. */}
        <FitBounds bars={located} userLocation={userLocation} programmatic={programmatic} />
      </MapContainer>

      {onSearchArea && moved && (
        <button
          type="button"
          onClick={() => {
            const b = mapRef.current?.getBounds()
            if (!b) return
            setMoved(false)
            onSearchArea([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()])
          }}
          className="absolute left-1/2 top-4 z-[500] flex h-10 -translate-x-1/2 animate-fade-up items-center gap-2 whitespace-nowrap rounded-full bg-surface px-4 text-sm font-semibold text-fg shadow-md hover:shadow-lg"
        >
          <Search className="size-4" /> Buscar en esta zona
        </button>
      )}

      {selected && (
        <div className="absolute inset-x-3 bottom-20 z-[500] mx-auto max-w-sm animate-fade-up md:bottom-6">
          <Link to={`/bares/${selected.slug}`} className="flex overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-black/5 transition-shadow hover:shadow-xl">
            {selected.coverUrl && <img src={selected.coverUrl} alt="" className="h-28 w-28 shrink-0 object-cover" />}
            <div className="min-w-0 flex-1 p-3.5 pr-10">
              <p className="truncate font-bold text-fg">{selected.name}</p>
              <p className="truncate text-sm text-fg-muted">
                {selected.category} · {selected.neighborhood}
              </p>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <PriceRange value={selected.priceRange} />
                {selected.isOpenNow !== undefined && (
                  <span className={cn('font-semibold', selected.isOpenNow ? 'text-success-700' : 'text-fg-muted')}>
                    {selected.isOpenNow ? 'Abierto' : 'Cerrado'}
                  </span>
                )}
                {selected.distanceMeters !== undefined && <span className="text-fg-muted">{formatDistance(selected.distanceMeters)}</span>}
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Cerrar vista previa"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-surface/90 text-fg-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
