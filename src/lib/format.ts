const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })
const numberFmt = new Intl.NumberFormat('es-MX')

export function formatDate(value: string | number | Date) {
  return dateFmt.format(new Date(value))
}

export function formatNumber(value: number) {
  return numberFmt.format(value)
}

/** Distancia legible: 350 m, 1.2 km, 14 km. */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  const km = meters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}
