import { useSyncExternalStore } from 'react'

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
export interface GeoState {
  status: GeoStatus
  coords?: { lat: number; lng: number }
}

const STORAGE_KEY = 'barmap:geo'
const MAX_AGE_MS = 15 * 60 * 1000

/**
 * Ubicación compartida por toda la app (home, explorar, detalle).
 * Solo se pide cuando el usuario pulsa un botón; se recuerda 15 min en
 * sessionStorage y nunca se envía a otro sitio que no sea la búsqueda.
 */
let state: GeoState = restore()
const listeners = new Set<() => void>()

function restore(): GeoState {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && Date.now() - saved.at < MAX_AGE_MS) return { status: 'granted', coords: saved.coords }
  } catch {
    /* almacenamiento no disponible */
  }
  return { status: 'idle' }
}

function set(next: GeoState) {
  state = next
  if (next.status === 'granted' && next.coords) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ coords: next.coords, at: Date.now() }))
    } catch {
      /* ignorar */
    }
  }
  listeners.forEach((l) => l())
}

export function requestLocation() {
  if (!('geolocation' in navigator)) return set({ status: 'unavailable' })
  set({ ...state, status: 'requesting' })
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      // 4 decimales (~11 m) bastan para ordenar por distancia.
      const round = (n: number) => Math.round(n * 1e4) / 1e4
      set({ status: 'granted', coords: { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) } })
    },
    (err) => set({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
  )
}

export function useGeolocation() {
  const geo = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
  return { ...geo, request: requestLocation }
}
