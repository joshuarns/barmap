import type { BarDetail } from '@/types/api'

/** Apple Maps en iOS/macOS; Google Maps en el resto (abre la app si está instalada). */
export function directionsUrl(bar: Pick<BarDetail, 'latitude' | 'longitude' | 'name'>) {
  const dest = `${bar.latitude},${bar.longitude}`
  const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
  return apple
    ? `https://maps.apple.com/?daddr=${dest}&q=${encodeURIComponent(bar.name)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

/** Comparte con la hoja nativa o copia el enlace. Devuelve qué ocurrió. */
export async function shareBar(bar: Pick<BarDetail, 'name' | 'category' | 'neighborhood' | 'city'>): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = window.location.href.split('#')[0]
  const text = `${bar.name} · ${[bar.category, bar.neighborhood ?? bar.city].filter(Boolean).join(' en ')}`
  if (navigator.share) {
    try {
      await navigator.share({ title: bar.name, text, url })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return legacyCopy(url) ? 'copied' : 'failed'
  }
}

/** Respaldo para contextos donde la API de portapapeles está bloqueada. */
function legacyCopy(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(el)
  el.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    el.remove()
  }
}

const DAY_SCHEMA = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** schema.org BarOrPub para SEO local. */
export function barJsonLd(bar: BarDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BarOrPub',
    name: bar.name,
    description: bar.description ?? undefined,
    url: window.location.href.split('#')[0],
    image: bar.images.slice(0, 5).map((i) => i.url),
    telephone: bar.phone ?? undefined,
    priceRange: '$'.repeat(bar.priceRange),
    servesCuisine: undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: bar.address,
      addressLocality: bar.city,
      addressRegion: bar.state ?? undefined,
      postalCode: bar.postalCode ?? undefined,
      addressCountry: bar.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: bar.latitude, longitude: bar.longitude },
    openingHoursSpecification: bar.hours
      .filter((h) => !h.isClosed && h.opens && h.closes)
      .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_SCHEMA[h.dayOfWeek], opens: h.opens, closes: h.closes })),
    sameAs: Object.values(bar.socialLinks),
  }
}

/** Día de la semana (0 = lunes) en la zona horaria del bar. */
export function todayIndex(timezone: string) {
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(new Date())
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name)
}

/** Hora local "HH:MM" en la zona horaria del bar. */
function localTime(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(new Date())
}

const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Texto de próxima apertura cuando está cerrado: "Abre hoy a las 18:00", "Abre el jueves a las 19:00". */
export function nextOpening(bar: Pick<BarDetail, 'hours' | 'timezone'>): string | null {
  if (!bar.hours.length) return null
  const today = todayIndex(bar.timezone)
  const now = localTime(bar.timezone)
  for (let offset = 0; offset < 7; offset++) {
    const day = (today + offset) % 7
    const h = bar.hours.find((x) => x.dayOfWeek === day)
    if (!h || h.isClosed || !h.opens) continue
    if (offset === 0 && h.opens <= now) continue
    if (offset === 0) return `Abre hoy a las ${h.opens}`
    if (offset === 1) return `Abre mañana a las ${h.opens}`
    return `Abre el ${DAY_NAMES[day]} a las ${h.opens}`
  }
  return null
}
