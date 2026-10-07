import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { limits } from '../middleware/security.js'

/** /api/geocode — propietarios y admins (requireRole en el montaje). */
export const geocodeRouter = Router()

// --- Geocodificación -------------------------------------------------
/**
 * Proxy a Nominatim (OpenStreetMap) para ubicar una dirección en el mapa.
 * Va por el servidor para identificar la app (exigido por su política de
 * uso), limitar la frecuencia y no exponer la IP del usuario. Bajo volumen:
 * en producción conviene un proveedor con contrato (p. ej. Stadia, Mapbox).
 */
const geoCache = new Map<string, { at: number; data: unknown }>()

geocodeRouter.get('/', limits.geocode, asyncHandler(async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(4).max(200) }).parse(req.query)
  const key = q.toLowerCase()
  const hit = geoCache.get(key)
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return res.json(hit.data)
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=mx&addressdetails=1&accept-language=es&q=${encodeURIComponent(q)}`
  let results: { lat: string; lon: string; display_name: string; address?: Record<string, string> }[] = []
  try {
    const r = await fetch(url, { headers: { 'User-Agent': `Barmap/0.1 (${config.appUrl})` }, signal: AbortSignal.timeout(6000) })
    if (r.ok) results = await r.json()
  } catch {
    throw new HttpError(502, 'No pudimos buscar la dirección. Marca la ubicación directamente en el mapa.', 'geocode_failed')
  }
  const data = {
    results: results.map((r) => ({
      label: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      postalCode: r.address?.postcode ?? '',
      city: r.address?.city ?? r.address?.town ?? r.address?.municipality ?? '',
      state: r.address?.state ?? '',
      neighborhood: r.address?.neighbourhood ?? r.address?.suburb ?? '',
    })),
  }
  if (geoCache.size > 500) geoCache.clear()
  geoCache.set(key, { at: Date.now(), data })
  res.json(data)
}))
