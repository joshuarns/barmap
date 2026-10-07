import request from 'supertest'
import sharp from 'sharp'
import { createApp } from '../src/app.js'
import { pool } from '../src/db/pool.js'

export const app = createApp()
export const ORIGIN = 'http://localhost:5173'
export const DEMO_PASSWORD = 'barmap-demo-1'

/** Agente con cookies + cabeceras que manda el navegador (Origin). */
export function agent() {
  const a = request.agent(app)
  return {
    get: (url: string) => a.get(url).set('Origin', ORIGIN),
    post: (url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body),
    put: (url: string, body: object = {}) => a.put(url).set('Origin', ORIGIN).send(body),
    del: (url: string) => a.delete(url).set('Origin', ORIGIN),
    upload: (url: string, buffer: Buffer, name = 'foto.jpg') => a.post(url).set('Origin', ORIGIN).attach('image', buffer, name),
    raw: a,
  }
}

export async function login(email: string, password = DEMO_PASSWORD) {
  const a = agent()
  const res = await a.post('/api/auth/login', { email, password })
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  return a
}

export const q = (sql: string, params?: unknown[]) => pool.query(sql, params)

export const jpeg = (w = 1600, h = 1000, color = '#c93d14') =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer()

/** Datos completos válidos para un bar. */
export function completeBar(name: string) {
  return {
    name,
    description: 'Bar de pruebas automatizadas con coctelería de autor, música y terraza amplia.',
    categoryId: 1, typeId: 1, country: 'MX', state: 'Ciudad de México', city: 'Ciudad de México', neighborhood: 'Roma Norte',
    address: 'Durango 200', postalCode: '06700', latitude: 19.419, longitude: -99.163,
    phone: '55 1111 2222', website: '', social: { instagram: '', facebook: '', tiktok: '' }, priceRange: 2,
    hours: Array.from({ length: 7 }, (_, d) => (d >= 3 ? { dayOfWeek: d, isClosed: false, opens: '18:00', closes: '02:00' } : { dayOfWeek: d, isClosed: true, opens: null, closes: null })),
    amenityIds: [1, 3],
  }
}
