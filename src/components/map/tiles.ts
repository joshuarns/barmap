import { env } from '@/config/env'

/**
 * Teselas raster de Stadia Maps (estilo "Alidade Smooth", claro y sobrio).
 * - Desarrollo: localhost funciona sin API key.
 * - Producción: registrar el dominio en Stadia (plan gratuito) o definir
 *   VITE_STADIA_API_KEY. Cambiar de proveedor = cambiar solo esta URL.
 * (CARTO ya exige API key; los servidores de OSM prohíben uso intensivo.)
 */
export const TILE_URL =
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png' +
  (env.stadiaApiKey ? `?api_key=${encodeURIComponent(env.stadiaApiKey)}` : '')
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export const PIN_SVG = `<svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true"><path fill="#C93D14" stroke="#fff" stroke-width="1.5" d="M16 1.5C9.1 1.5 3.5 7 3.5 13.8c0 8.7 10.4 16.1 11.6 16.9.5.4 1.3.4 1.8 0 1.2-.8 11.6-8.2 11.6-16.9C28.5 7 22.9 1.5 16 1.5Z"/><path fill="#fff" d="M9.6 8.6h12.8c.6 0 .9.7.5 1.1l-5.6 6.1v4.6h2.3a.9.9 0 0 1 0 1.8h-7.2a.9.9 0 0 1 0-1.8h2.3v-4.6L9.1 9.7c-.4-.4-.1-1.1.5-1.1Z"/></svg>`
