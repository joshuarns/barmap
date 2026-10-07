import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { PIN_SVG, TILE_ATTRIBUTION, TILE_URL } from './tiles'

const pin = L.divIcon({ className: 'bm-pin-wrap', html: PIN_SVG, iconSize: [40, 40], iconAnchor: [20, 38] })
const DEFAULT: [number, number] = [19.4326, -99.1332]

interface Props {
  value: { lat: number; lng: number } | null
  onChange: (v: { lat: number; lng: number }) => void
  /** Cambia cuando la ubicación viene de fuera (búsqueda, GPS) para recentrar. */
  focusKey?: number
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

function ClickToPlace({ onChange }: { onChange: Props['onChange'] }) {
  useMapEvents({ click: (e) => onChange({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }) })
  return null
}

function Recenter({ value, focusKey }: { value: Props['value']; focusKey?: number }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 17), { duration: 0.6 })
    // Solo al cambiar focusKey (ubicación externa), no al arrastrar el pin.
  }, [focusKey])
  return null
}

/** Mapa para fijar la ubicación exacta: clic en el mapa o arrastrar el pin. */
export default function LocationPicker({ value, onChange, focusKey }: Props) {
  const handlers = useMemo(
    () => ({
      dragend: (e: L.LeafletEvent) => {
        const p = (e.target as L.Marker).getLatLng()
        onChange({ lat: round(p.lat), lng: round(p.lng) })
      },
    }),
    [onChange],
  )
  return (
    <MapContainer center={value ? [value.lat, value.lng] : DEFAULT} zoom={value ? 17 : 12} scrollWheelZoom className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={20} />
      <ClickToPlace onChange={onChange} />
      <Recenter value={value} focusKey={focusKey} />
      {value && <Marker position={[value.lat, value.lng]} icon={pin} draggable eventHandlers={handlers} title="Arrastra para ajustar" />}
    </MapContainer>
  )
}
