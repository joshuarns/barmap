import { describe, expect, it, vi } from 'vitest'
import { parseFilters, serializeFilters } from '@/features/bars/filters'
import { validateSteps, stepOf, type BarFields } from '@/features/owner/bars'
import { nextOpening } from '@/features/bar-detail/actions'

describe('filtros de búsqueda en la URL', () => {
  it('ida y vuelta sin perder información', () => {
    const f = parseFilters(new URLSearchParams('q=mezcal&donde=Roma&categoria=cocteleria&precio=1,3&servicios=wifi,terraza&abierto=1&radio=5&orden=distance&vista=mapa&page=2'))
    expect(f).toMatchObject({ q: 'mezcal', donde: 'Roma', precio: [1, 3], servicios: ['wifi', 'terraza'], abierto: true, radio: 5, orden: 'distance', vista: 'mapa', page: 2 })
    expect(parseFilters(serializeFilters(f))).toEqual(f)
  })

  it('descarta valores inválidos de la URL', () => {
    const f = parseFilters(new URLSearchParams('precio=0,9,2&radio=7&orden=hack&page=-3&bbox=1,2,x,4'))
    expect(f.precio).toEqual([2])
    expect(f.radio).toBeUndefined()
    expect(f.orden).toBeUndefined()
    expect(f.page).toBe(1)
    expect(f.bbox).toBeUndefined()
  })
})

const base: BarFields = {
  name: 'Bar', description: 'x'.repeat(40), categoryId: 1, typeId: 1, country: 'MX', state: 'CDMX', city: 'CDMX', neighborhood: '',
  address: 'Calle 123', postalCode: '06700', latitude: 19.4, longitude: -99.1, phone: '55 1234 5678', website: '',
  social: { instagram: '', facebook: '', tiktok: '' }, priceRange: 2,
  hours: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isClosed: d !== 4, opens: d === 4 ? '18:00' : null, closes: d === 4 ? '02:00' : null })),
  amenityIds: [],
}

describe('validación del formulario de establecimiento', () => {
  it('acepta un establecimiento completo', () => {
    expect(validateSteps(base, 3)).toEqual({})
  })

  it('agrupa los errores por paso', () => {
    const e = validateSteps({ ...base, description: 'corta', latitude: null, phone: '' }, 1)
    expect(Object.keys(e).sort()).toEqual(['contact', 'description', 'images', 'location'])
    expect(stepOf('description')).toBe(0)
    expect(stepOf('location')).toBe(1)
    expect(stepOf('contact')).toBe(2)
    expect(stepOf('images')).toBe(3)
  })

  it('exige horas completas en días abiertos', () => {
    const hours = base.hours.map((h) => (h.dayOfWeek === 4 ? { ...h, closes: null } : h))
    expect(validateSteps({ ...base, hours }, 3).hours).toBeDefined()
  })
})

describe('próxima apertura', () => {
  it('indica si abre hoy, mañana u otro día', () => {
    vi.useFakeTimers()
    // Miércoles 7 de octubre de 2026, 15:00 en Ciudad de México (21:00 UTC)
    vi.setSystemTime(new Date('2026-10-07T21:00:00Z'))
    const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isClosed: d !== 2 && d !== 4, opens: '18:00', closes: '02:00' }))
    expect(nextOpening({ hours, timezone: 'America/Mexico_City' })).toBe('Abre hoy a las 18:00')
    vi.setSystemTime(new Date('2026-10-08T05:00:00Z')) // miércoles 23:00 → próximo: viernes
    expect(nextOpening({ hours, timezone: 'America/Mexico_City' })).toBe('Abre el viernes a las 18:00')
    vi.useRealTimers()
  })
})
