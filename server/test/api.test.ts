import { afterAll, describe, expect, it } from 'vitest'
import { pool } from '../src/db/pool.js'
import { agent, completeBar, jpeg, login, q } from './helpers.js'

afterAll(() => pool.end())

describe('Público: solo se ve lo aprobado', () => {
  it('lista bares publicados y oculta borradores, pendientes y de cuentas suspendidas', async () => {
    const res = await agent().get('/api/bars?pageSize=100')
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThan(20)
    const names: string[] = res.body.items.map((b: { name: string }) => b.name)
    expect(names).not.toContain('Borrador Oculto')
    expect(names).not.toContain('Pendiente Oculto')
    expect(names).not.toContain('Bar De Cuenta Suspendida')
  })

  it('responde 404 en el detalle de un bar no publicado (igual que si no existiera)', async () => {
    for (const slug of ['borrador-oculto', 'pendiente-oculto', 'bar-de-cuenta-suspendida', 'no-existe']) {
      expect((await agent().get(`/api/bars/${slug}`)).status).toBe(404)
    }
  })

  it('no expone datos privados del propietario ni internos', async () => {
    const res = await agent().get('/api/bars/salon-verde')
    expect(res.status).toBe(200)
    const body = JSON.stringify(res.body)
    for (const leak of ['owner_id', 'ownerId', 'email', 'password', 'moderation', 'token_version']) expect(body).not.toContain(leak)
  })

  it('valida los parámetros de búsqueda', async () => {
    expect((await agent().get('/api/bars?precio=9')).status).toBe(422)
    expect((await agent().get('/api/bars?q=%25')).status).toBe(200)
  })
})

describe('Autenticación y roles', () => {
  const email = `nuevo${Date.now()}@test.mx`

  it('registrarse siempre crea un visitante aunque se envíe otro rol', async () => {
    const a = agent()
    const res = await a.post('/api/auth/register', { name: 'Persona Prueba', email, password: 'clave1234', acceptTerms: true, role: 'admin' })
    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('visitor')
    expect(res.body.user.emailVerified).toBe(false)
  })

  it('no permite duplicar correos', async () => {
    const res = await agent().post('/api/auth/register', { name: 'Otra', email, password: 'clave1234', acceptTerms: true })
    expect(res.status).toBe(409)
  })

  it('mismo mensaje si el correo no existe o la contraseña es incorrecta', async () => {
    const a = await agent().post('/api/auth/login', { email: 'admin@demo.barmap.local', password: 'mal' })
    const b = await agent().post('/api/auth/login', { email: 'nadie@test.mx', password: 'mal' })
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(a.body.error.message).toBe(b.body.error.message)
  })

  it('protege rutas por rol', async () => {
    expect((await agent().get('/api/owner/bars')).status).toBe(401)
    const visitor = await login('solicitante@demo.barmap.local')
    expect((await visitor.get('/api/owner/bars')).status).toBe(403)
    expect((await visitor.get('/api/admin/moderation')).status).toBe(403)
    const owner = await login('owner@demo.barmap.local')
    expect((await owner.get('/api/admin/users')).status).toBe(403)
  })

  it('rechaza mutaciones desde otro origen o que no sean JSON (CSRF)', async () => {
    const a = await login('owner@demo.barmap.local')
    const evil = await a.raw.post('/api/owner/bars').set('Origin', 'https://evil.example').send({ name: 'X' })
    expect(evil.status).toBe(403)
    const form = await a.raw.post('/api/owner/bars').set('Origin', 'http://localhost:5173').type('form').send('name=Hack')
    expect(form.status).toBe(415)
  })
})

describe('Solicitud de propietario', () => {
  it('exige correo verificado, no permite duplicar pendientes y solo un admin la aprueba', async () => {
    const email = `dueno${Date.now()}@test.mx`
    const a = agent()
    await a.post('/api/auth/register', { name: 'Dueña Prueba', email, password: 'clave1234', acceptTerms: true })
    const body = { businessName: 'Bar Test', contactPhone: '55 1234 5678', city: 'CDMX', role: 'owner' }

    expect((await a.post('/api/owner/application', body)).status).toBe(403) // sin verificar
    await q(`UPDATE users SET email_verified_at = now() WHERE email = $1`, [email])
    expect((await a.post('/api/owner/application', { ...body, application_status: 'approved' })).status).toBe(422) // campo inyectado
    expect((await a.post('/api/owner/application', body)).status).toBe(201)
    expect((await a.post('/api/owner/application', body)).status).toBe(409)

    const apps = await a.get('/api/owner/application')
    const appId = apps.body.applications[0].id
    expect((await a.post(`/api/admin/applications/${appId}/decision`, { decision: 'approve' })).status).toBe(403)

    const admin = await login('admin@demo.barmap.local')
    expect((await admin.post(`/api/admin/applications/${appId}/decision`, { decision: 'reject' })).status).toBe(422) // sin motivo
    expect((await admin.post(`/api/admin/applications/${appId}/decision`, { decision: 'approve' })).status).toBe(200)
    expect((await admin.post(`/api/admin/applications/${appId}/decision`, { decision: 'approve' })).status).toBe(409)
    expect((await a.get('/api/auth/me')).body.user.role).toBe('owner')
  })
})

describe('Establecimientos: alta, moderación y versionado', () => {
  let barId = ''
  let slug = ''
  const name = `Bar Automatizado ${Date.now()}`

  it('un propietario crea un borrador y no puede enviarlo incompleto', async () => {
    const owner = await login('owner@demo.barmap.local')
    const res = await owner.post('/api/owner/bars', { name })
    expect(res.status).toBe(201)
    barId = res.body.bar.id
    expect(res.body.bar.status).toBe('draft')
    const submit = await owner.post(`/api/owner/bars/${barId}/submit`)
    expect(submit.status).toBe(422)
    expect(Object.keys(submit.body.error.details)).toEqual(expect.arrayContaining(['description', 'images', 'location']))
  })

  it('no acepta campos de estado desde el cliente', async () => {
    const owner = await login('owner@demo.barmap.local')
    const res = await owner.put(`/api/owner/bars/${barId}`, { ...completeBar(name), publication_status: 'published' })
    expect(res.status).toBe(422)
  })

  it('otro usuario no puede ver ni editar el bar (404)', async () => {
    const other = await login('suspended@demo.barmap.local')
    expect((await other.get(`/api/owner/bars/${barId}`)).status).toBe(404)
    const visitor = await login('solicitante@demo.barmap.local')
    expect((await visitor.get(`/api/owner/bars/${barId}`)).status).toBe(403)
  })

  it('valida las fotos por su contenido y tamaño', async () => {
    const owner = await login('owner@demo.barmap.local')
    expect((await owner.upload(`/api/owner/bars/${barId}/images`, Buffer.from('no soy una imagen'))).status).toBe(422)
    expect((await owner.upload(`/api/owner/bars/${barId}/images`, await jpeg(400, 300))).status).toBe(422)
    for (const c of ['#111111', '#222222', '#333333']) {
      expect((await owner.upload(`/api/owner/bars/${barId}/images`, await jpeg(1600, 1000, c))).status).toBe(201)
    }
  })

  it('completo, se envía a revisión, queda bloqueado y oculto al público', async () => {
    const owner = await login('owner@demo.barmap.local')
    expect((await owner.put(`/api/owner/bars/${barId}`, completeBar(name))).status).toBe(200)
    const sub = await owner.post(`/api/owner/bars/${barId}/submit`)
    expect(sub.status).toBe(200)
    expect(sub.body.bar.status).toBe('pending_review')
    slug = sub.body.bar.slug
    expect((await owner.put(`/api/owner/bars/${barId}`, completeBar(name))).status).toBe(409)
    expect((await agent().get(`/api/bars/${slug}`)).status).toBe(404)
  })

  it('el propietario no puede aprobarse a sí mismo; el admin sí', async () => {
    const owner = await login('owner@demo.barmap.local')
    expect((await owner.post(`/api/admin/bars/${barId}/decision`, { target: 'bar', decision: 'approve' })).status).toBe(403)
    const admin = await login('admin@demo.barmap.local')
    const res = await admin.post(`/api/admin/bars/${barId}/decision`, { target: 'bar', decision: 'approve' })
    expect(res.status).toBe(200)
    expect(res.body.bar.status).toBe('published')
    expect((await agent().get(`/api/bars/${slug}`)).status).toBe(200)
    const log = await q(`SELECT action FROM moderation_logs WHERE entity_type = 'bar' AND entity_id = $1`, [barId])
    expect(log.rows.map((r) => r.action)).toContain('approve')
  })

  it('editar un bar publicado crea una revisión; el público no cambia hasta aprobarla', async () => {
    const owner = await login('owner@demo.barmap.local')
    const changed = { ...completeBar(name), priceRange: 4 }
    const save = await owner.put(`/api/owner/bars/${barId}`, changed)
    expect(save.body.revision.status).toBe('draft')
    expect((await owner.upload(`/api/owner/bars/${barId}/images`, await jpeg(1600, 1000, '#444444'))).status).toBe(201)
    expect((await agent().get(`/api/bars/${slug}`)).body.priceRange).toBe(2)
    expect((await agent().get(`/api/bars/${slug}`)).body.images).toHaveLength(3)

    const sub = await owner.post(`/api/owner/bars/${barId}/submit`)
    expect(sub.body.revision.status).toBe('pending_review')
    const rev = await q(`SELECT changed_fields FROM bar_revisions WHERE bar_id = $1 AND status = 'pending_review'`, [barId])
    expect(rev.rows[0].changed_fields.sort()).toEqual(['imageIds', 'priceRange'])

    const admin = await login('admin@demo.barmap.local')
    expect((await admin.post(`/api/admin/bars/${barId}/decision`, { target: 'revision', decision: 'approve' })).status).toBe(200)
    const pub = await agent().get(`/api/bars/${slug}`)
    expect(pub.body.priceRange).toBe(4)
    expect(pub.body.images).toHaveLength(4)
  })

  it('no aprueba una revisión basada en una versión anterior', async () => {
    const owner = await login('owner@demo.barmap.local')
    await owner.put(`/api/owner/bars/${barId}`, { ...completeBar(name), priceRange: 3 })
    await owner.post(`/api/owner/bars/${barId}/submit`)
    const admin = await login('admin@demo.barmap.local')
    const live = (await admin.get(`/api/admin/bars/${barId}`)).body.data
    expect((await admin.put(`/api/admin/bars/${barId}`, { data: { ...live, phone: '55 9999 9999' } })).status).toBe(200)
    const res = await admin.post(`/api/admin/bars/${barId}/decision`, { target: 'revision', decision: 'approve' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('outdated')
  })
})

describe('Suspensión de cuentas', () => {
  it('suspender a un propietario oculta sus bares y cierra su sesión', async () => {
    const owner = await login('owner@demo.barmap.local')
    const admin = await login('admin@demo.barmap.local')
    const before = (await agent().get('/api/bars?pageSize=100')).body.total
    const { rows } = await q(`SELECT id FROM users WHERE email = 'owner@demo.barmap.local'`)
    expect((await admin.post(`/api/admin/users/${rows[0].id}/status`, { action: 'suspend', reason: 'Prueba automatizada de suspensión' })).status).toBe(200)

    expect((await owner.get('/api/auth/me')).body.user).toBeNull()
    expect((await agent().get('/api/bars?pageSize=100')).body.total).toBeLessThan(before)

    expect((await admin.post(`/api/admin/users/${rows[0].id}/status`, { action: 'reactivate' })).status).toBe(200)
    expect((await agent().get('/api/bars?pageSize=100')).body.total).toBe(before)
  })

  it('un admin no puede suspenderse a sí mismo', async () => {
    const admin = await login('admin@demo.barmap.local')
    const { rows } = await q(`SELECT id FROM users WHERE email = 'admin@demo.barmap.local'`)
    expect((await admin.post(`/api/admin/users/${rows[0].id}/status`, { action: 'suspend', reason: 'Intento de autosuspensión' })).status).toBe(403)
  })
})

describe('Favoritos, reportes y analítica', () => {
  it('solo se pueden guardar bares públicos', async () => {
    const v = await login('solicitante@demo.barmap.local')
    const pub = await q(`SELECT id FROM bars WHERE slug = 'salon-verde'`)
    const hidden = await q(`SELECT id FROM bars WHERE name = 'Borrador Oculto'`)
    expect((await v.put(`/api/me/favorites/${pub.rows[0].id}`)).status).toBe(200)
    expect((await v.put(`/api/me/favorites/${hidden.rows[0].id}`)).status).toBe(404)
    expect((await v.get('/api/me/favorites/ids')).body.ids).toContain(pub.rows[0].id)
  })

  it('un mismo visitante cuenta una sola visita por día', async () => {
    const before = await q(`SELECT coalesce(sum(views), 0)::int AS n FROM bar_daily_stats s JOIN bars b ON b.id = s.bar_id WHERE b.slug = 'vinoteca-olivo' AND day = current_date`)
    for (let i = 0; i < 3; i++) expect((await agent().post('/api/bars/vinoteca-olivo/events', { type: 'view' })).status).toBe(204)
    const after = await q(`SELECT coalesce(sum(views), 0)::int AS n FROM bar_daily_stats s JOIN bars b ON b.id = s.bar_id WHERE b.slug = 'vinoteca-olivo' AND day = current_date`)
    expect(after.rows[0].n - before.rows[0].n).toBe(1)
  })

  it('evita reportes duplicados del mismo visitante', async () => {
    const a = agent()
    expect((await a.post('/api/bars/lupulo-norte/reports', { reason: 'wrong_info' })).status).toBe(201)
    expect((await a.post('/api/bars/lupulo-norte/reports', { reason: 'wrong_info' })).status).toBe(409)
  })
})

describe('Integridad en la base de datos', () => {
  it('el historial de moderación no se puede modificar ni borrar', async () => {
    await expect(q(`UPDATE moderation_logs SET comment = 'x'`)).rejects.toThrow(/solo inserción/)
    await expect(q(`DELETE FROM moderation_logs`)).rejects.toThrow(/solo inserción/)
  })

  it('no se puede publicar un bar incompleto ni siquiera por SQL', async () => {
    const { rows } = await q(`SELECT id FROM users WHERE email = 'owner@demo.barmap.local'`)
    await expect(q(`INSERT INTO bars (owner_id, name, slug, publication_status) VALUES ($1, 'X', 'x-incompleto', 'published')`, [rows[0].id])).rejects.toThrow(/bars_complete_when_submitted/)
  })
})
