import L from 'leaflet'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { PIN_SVG, TILE_ATTRIBUTION, TILE_URL } from './tiles'

const pin = L.divIcon({ className: 'bm-pin-wrap', html: PIN_SVG, iconSize: [40, 40], iconAnchor: [20, 38] })

/** Mapa de ubicación de un solo bar (detalle). Sin zoom con rueda para no secuestrar el scroll. */
export default function LocationMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={20} />
      <Marker position={[lat, lng]} icon={pin} title={label} />
    </MapContainer>
  )
}
