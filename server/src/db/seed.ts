/**
 * Semilla de DESARROLLO. Crea un propietario de demostración con bares
 * ficticios (nombres inventados) para poder usar el sitio público antes de
 * que existan el registro y la moderación (Etapas 3-5).
 *
 * - Idempotente: borra y recrea todo lo que pertenece a *@demo.barmap.local.
 * - Incluye bares NO públicos (borrador, en revisión, de cuenta suspendida)
 *   para verificar que nunca aparecen en la API pública.
 * - Cuentas demo con contraseña DEMO_PASSWORD (por defecto "barmap-demo-1"):
 *     admin@demo.barmap.local      administrador
 *     owner@demo.barmap.local      propietario aprobado (dueño de los bares)
 *     solicitante@demo.barmap.local visitante verificado con solicitud pendiente
 *
 * Uso: npm run seed   (se niega a correr con NODE_ENV=production)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { pool } from './pool.js'
import { getWorkingCopy, saveDraft, submitForReview } from '../services/ownerBars.js'
import { hashPassword } from '../lib/auth.js'

if (process.env.NODE_ENV === 'production') {
  console.error('La semilla de demostración no se ejecuta en producción.')
  process.exit(1)
}

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&h=933&q=75`

const PHOTOS = {
  interior: ['1514933651103-005eec06c04b', '1572116469696-31de0f17cc34', '1543007630-9710e4a00a20', '1525268323446-0505b6fe7778', '1597290282695-edc43d0e7129', '1578474846511-04ba529f0b88', '1497644083578-611b798c60f3', '1575444758702-4a6b9222336e'],
  cocktail: ['1470337458703-46ad1756a187', '1551024709-8f23befc6f87', '1536935338788-846bb9981813', '1514362545857-3bc16c4c7d1b', '1556679343-c7306c1976bc', '1470338745628-171cf53de3a8', '1609951651556-5334e2706168', '1546171753-97d7676e4602', '1513558161293-cdaf765ed2fd', '1600271886742-f049cd451bba'],
  beer: ['1586993451228-09818021e309', '1555658636-6e4a36218be7', '1535958636474-b021ee887b13', '1608270586620-248524c67de9', '1532634922-8fe0b757fb13', '1571613316887-6f8d5cbf7ef7', '1528823872057-9c018a7a7553'],
  wine: ['1510812431401-41d2bd2722f3', '1474722883778-792e7990302f'],
  crowd: ['1519671482749-fd09be7ccebf', '1485872299829-c673f5194813', '1517457373958-b7bdd4587205', '1541532713592-79a0317b6b77', '1566417713940-fe7c737a9ef2'],
  garden: ['1600093463592-8e36ae95ef56', '1559339352-11d035aa65de'],
}
type Theme = keyof typeof PHOTOS

type Hours = 'night' | 'late' | 'afternoon' | 'weekend' | 'daily'
const HOURS: Record<Hours, ([string, string] | null)[]> = {
  // lunes … domingo
  night: [null, ['19:00', '01:00'], ['19:00', '01:00'], ['19:00', '02:00'], ['19:00', '03:00'], ['19:00', '03:00'], null],
  late: [['18:00', '00:00'], ['18:00', '00:00'], ['18:00', '01:00'], ['18:00', '02:00'], ['18:00', '03:00'], ['17:00', '03:00'], ['17:00', '23:00']],
  afternoon: [['13:00', '23:00'], ['13:00', '23:00'], ['13:00', '23:00'], ['13:00', '00:00'], ['13:00', '02:00'], ['12:00', '02:00'], ['12:00', '22:00']],
  weekend: [null, null, null, ['20:00', '02:00'], ['20:00', '04:00'], ['20:00', '04:00'], null],
  daily: [['12:00', '02:00'], ['12:00', '02:00'], ['12:00', '02:00'], ['12:00', '02:00'], ['12:00', '02:00'], ['12:00', '02:00'], ['12:00', '02:00']],
}

interface SeedBar {
  name: string
  category: string
  type: string
  price: 1 | 2 | 3 | 4
  area: keyof typeof AREAS
  street: string
  theme: Theme[]
  hours: Hours
  amenities: string[]
  description: string
  featured?: boolean
  verified?: boolean
}

const AREAS = {
  roma: { neighborhood: 'Roma Norte', city: 'Ciudad de México', state: 'CDMX', cp: '06700', lat: 19.4167, lng: -99.1617 },
  condesa: { neighborhood: 'Condesa', city: 'Ciudad de México', state: 'CDMX', cp: '06140', lat: 19.4115, lng: -99.1733 },
  juarez: { neighborhood: 'Juárez', city: 'Ciudad de México', state: 'CDMX', cp: '06600', lat: 19.427, lng: -99.157 },
  polanco: { neighborhood: 'Polanco', city: 'Ciudad de México', state: 'CDMX', cp: '11560', lat: 19.4326, lng: -99.1937 },
  centro: { neighborhood: 'Centro Histórico', city: 'Ciudad de México', state: 'CDMX', cp: '06000', lat: 19.4336, lng: -99.1368 },
  coyoacan: { neighborhood: 'Coyoacán', city: 'Ciudad de México', state: 'CDMX', cp: '04000', lat: 19.3496, lng: -99.1617 },
  narvarte: { neighborhood: 'Narvarte', city: 'Ciudad de México', state: 'CDMX', cp: '03020', lat: 19.3967, lng: -99.1566 },
  sanrafael: { neighborhood: 'San Rafael', city: 'Ciudad de México', state: 'CDMX', cp: '06470', lat: 19.4385, lng: -99.1628 },
  americana: { neighborhood: 'Americana', city: 'Guadalajara', state: 'Jalisco', cp: '44160', lat: 20.6737, lng: -103.369 },
  providencia: { neighborhood: 'Providencia', city: 'Guadalajara', state: 'Jalisco', cp: '44630', lat: 20.696, lng: -103.389 },
  gdlcentro: { neighborhood: 'Centro', city: 'Guadalajara', state: 'Jalisco', cp: '44100', lat: 20.6767, lng: -103.3475 },
  barrioantiguo: { neighborhood: 'Barrio Antiguo', city: 'Monterrey', state: 'Nuevo León', cp: '64000', lat: 25.6664, lng: -100.3073 },
  sanpedro: { neighborhood: 'Del Valle', city: 'San Pedro Garza García', state: 'Nuevo León', cp: '66220', lat: 25.657, lng: -100.402 },
  oaxaca: { neighborhood: 'Centro', city: 'Oaxaca', state: 'Oaxaca', cp: '68000', lat: 17.062, lng: -96.725 },
  merida: { neighborhood: 'Santa Ana', city: 'Mérida', state: 'Yucatán', cp: '97000', lat: 20.979, lng: -89.623 },
}

const BARS: SeedBar[] = [
  { name: 'La Azotea de Colima', category: 'rooftop', type: 'lounge', price: 3, area: 'roma', street: 'Colima 214', theme: ['interior', 'cocktail', 'garden'], hours: 'late', amenities: ['terraza', 'acepta-tarjeta', 'reservaciones', 'comida'], description: 'Terraza con vista a los tinacos más bonitos de la Roma. Coctelería de temporada con frutas mexicanas y DJ los fines de semana.', featured: true, verified: true },
  { name: 'Mezcalería El Tigre Azul', category: 'mezcaleria', type: 'bar', price: 2, area: 'condesa', street: 'Tamaulipas 88', theme: ['interior', 'cocktail'], hours: 'afternoon', amenities: ['acepta-tarjeta', 'comida', 'musica-en-vivo'], description: 'Más de 60 etiquetas de mezcal de pequeños productores de Oaxaca, Durango y Guerrero. Catas guiadas los jueves.', verified: true },
  { name: 'Lúpulo Norte', category: 'cerveceria', type: 'pub', price: 1, area: 'juarez', street: 'Versalles 41', theme: ['beer', 'crowd'], hours: 'afternoon', amenities: ['wifi', 'pet-friendly', 'acepta-tarjeta', 'comida'], description: 'Veinte grifos de cerveza artesanal mexicana que rotan cada semana. Pet friendly y con pizzas al horno de leña.' },
  { name: 'Salón Verde', category: 'cocteleria', type: 'lounge', price: 4, area: 'polanco', street: 'Emilio Castelar 135', theme: ['interior', 'cocktail'], hours: 'night', amenities: ['reservaciones', 'acepta-tarjeta', 'accesible'], description: 'Barra de autor entre plantas y terciopelo. Menú de cócteles basado en destilados mexicanos y técnicas clásicas.', featured: true, verified: true },
  { name: 'Cantina La Paloma Negra', category: 'cocteleria', type: 'cantina', price: 1, area: 'centro', street: 'República de Cuba 57', theme: ['interior', 'crowd'], hours: 'daily', amenities: ['comida', 'musica-en-vivo'], description: 'Cantina de las de antes: botana con cada ronda, dominó y música de trío los viernes.' },
  { name: 'Speakeasy 1920', category: 'speakeasy', type: 'bar', price: 3, area: 'roma', street: 'Orizaba 101', theme: ['interior', 'cocktail'], hours: 'night', amenities: ['reservaciones', 'acepta-tarjeta'], description: 'Toca el timbre detrás de la barbería. Jazz en vivo, poca luz y cócteles de la era de la prohibición.', verified: true },
  { name: 'Vinoteca Olivo', category: 'wine-bar', type: 'bar', price: 3, area: 'condesa', street: 'Michoacán 30', theme: ['wine', 'interior'], hours: 'afternoon', amenities: ['terraza', 'acepta-tarjeta', 'comida', 'reservaciones'], description: 'Vinos naturales de Valle de Guadalupe y Europa por copa. Tablas de quesos mexicanos y terraza tranquila.' },
  { name: 'Karaoke Neón', category: 'karaoke', type: 'club', price: 2, area: 'juarez', street: 'Hamburgo 150', theme: ['crowd', 'cocktail'], hours: 'weekend', amenities: ['acepta-tarjeta', 'reservaciones'], description: 'Cuartos privados y escenario abierto. Más de 30 mil canciones y cubetas para el grupo.' },
  { name: 'El Estadio', category: 'deportivo', type: 'bar-restaurante', price: 2, area: 'narvarte', street: 'Eje Central 800', theme: ['beer', 'crowd'], hours: 'daily', amenities: ['wifi', 'comida', 'acepta-tarjeta', 'accesible', 'estacionamiento'], description: 'Doce pantallas, alitas y cerveza de barril. Todos los partidos de Liga MX, NFL y Champions.' },
  { name: 'Jazz & Mezcal Coyoacán', category: 'musica-en-vivo', type: 'bar', price: 2, area: 'coyoacan', street: 'Higuera 22', theme: ['interior', 'crowd'], hours: 'late', amenities: ['musica-en-vivo', 'terraza', 'comida'], description: 'Casona con patio a dos cuadras de la plaza. Jazz, son y trova en vivo de miércoles a domingo.' },
  { name: 'Barra Sanrafa', category: 'cocteleria', type: 'bar', price: 2, area: 'sanrafael', street: 'Sadi Carnot 44', theme: ['cocktail', 'interior'], hours: 'late', amenities: ['acepta-tarjeta', 'pet-friendly'], description: 'Bar de barrio con coctelería seria y precios honestos. Highballs, spritz y clásicos bien hechos.' },
  { name: 'Terraza Reforma 222', category: 'rooftop', type: 'lounge', price: 4, area: 'juarez', street: 'Paseo de la Reforma 222', theme: ['garden', 'cocktail'], hours: 'late', amenities: ['terraza', 'reservaciones', 'acepta-tarjeta', 'accesible', 'estacionamiento'], description: 'Piso 18 con vista al Ángel. Ideal para atardeceres y celebraciones.', featured: true },
  { name: 'Pulquería Los Insurgentes', category: 'mezcaleria', type: 'cantina', price: 1, area: 'roma', street: 'Insurgentes Sur 226', theme: ['crowd', 'beer'], hours: 'afternoon', amenities: ['musica-en-vivo', 'comida'], description: 'Curados de temporada, mezcal y ambiente de barrio en tres pisos con música diferente cada uno.' },
  { name: 'Hop Station', category: 'cerveceria', type: 'pub', price: 2, area: 'polanco', street: 'Moliere 310', theme: ['beer'], hours: 'afternoon', amenities: ['wifi', 'comida', 'acepta-tarjeta', 'terraza'], description: 'Cervecería con producción propia: IPA, stouts y sours hechas en el sitio. Visitas a la planta los sábados.' },
  { name: 'Cava Escondida', category: 'speakeasy', type: 'bar', price: 4, area: 'condesa', street: 'Ámsterdam 67', theme: ['wine', 'interior', 'cocktail'], hours: 'night', amenities: ['reservaciones', 'acepta-tarjeta'], description: 'Sótano de ladrillo con barra de 12 lugares. Solo con reservación.', verified: true },
  { name: 'Casa Tequila Americana', category: 'mezcaleria', type: 'bar', price: 2, area: 'americana', street: 'Av. Chapultepec 110', theme: ['cocktail', 'interior'], hours: 'late', amenities: ['terraza', 'acepta-tarjeta', 'comida'], description: 'Tequilas y raicillas de Jalisco en una casona de la colonia Americana.', featured: true, verified: true },
  { name: 'Cervecería Providencia', category: 'cerveceria', type: 'pub', price: 1, area: 'providencia', street: 'Rubén Darío 900', theme: ['beer', 'crowd'], hours: 'afternoon', amenities: ['pet-friendly', 'wifi', 'estacionamiento'], description: 'Patio grande, cerveza local y food trucks rotativos.' },
  { name: 'Mariachi Bar Centro', category: 'musica-en-vivo', type: 'cantina', price: 2, area: 'gdlcentro', street: 'Pedro Moreno 400', theme: ['crowd', 'interior'], hours: 'daily', amenities: ['musica-en-vivo', 'comida', 'acepta-tarjeta'], description: 'Mariachi en vivo todas las noches, a unos pasos de la Catedral.' },
  { name: 'Rooftop Chapultepec GDL', category: 'rooftop', type: 'lounge', price: 3, area: 'americana', street: 'Libertad 1800', theme: ['garden', 'cocktail'], hours: 'weekend', amenities: ['terraza', 'reservaciones', 'acepta-tarjeta'], description: 'Terraza con vista a la ciudad y DJ sets al atardecer.' },
  { name: 'Barrio Antiguo Social', category: 'cocteleria', type: 'bar', price: 2, area: 'barrioantiguo', street: 'Padre Mier 1050', theme: ['cocktail', 'crowd'], hours: 'weekend', amenities: ['musica-en-vivo', 'acepta-tarjeta'], description: 'Casona restaurada con tres barras y patio central.', verified: true },
  { name: 'Sierra Madre Taproom', category: 'cerveceria', type: 'pub', price: 2, area: 'sanpedro', street: 'Calzada del Valle 400', theme: ['beer'], hours: 'afternoon', amenities: ['wifi', 'estacionamiento', 'comida', 'accesible'], description: 'Cerveza regiomontana de barril y cortes a la parrilla.' },
  { name: 'La Tuna Karaoke', category: 'karaoke', type: 'bar', price: 1, area: 'barrioantiguo', street: 'Diego de Montemayor 900', theme: ['crowd'], hours: 'weekend', amenities: ['acepta-tarjeta'], description: 'Karaoke abierto, micheladas y mucha actitud.' },
  { name: 'Mezcaloteca Oaxaqueña', category: 'mezcaleria', type: 'bar', price: 2, area: 'oaxaca', street: 'Reforma 506', theme: ['interior', 'cocktail'], hours: 'afternoon', amenities: ['reservaciones', 'comida'], description: 'Catas de mezcal ancestral directo del palenque. Aprende a distinguir agaves.', featured: true, verified: true },
  { name: 'Patio Santa Ana', category: 'cocteleria', type: 'bar-restaurante', price: 2, area: 'merida', street: 'Calle 60 470', theme: ['garden', 'cocktail'], hours: 'late', amenities: ['terraza', 'pet-friendly', 'comida', 'acepta-tarjeta'], description: 'Jardín con árboles de mango y coctelería con xtabentún y frutas de la península.' },
  { name: 'Salón Tropical', category: 'musica-en-vivo', type: 'club', price: 2, area: 'centro', street: 'Isabel la Católica 30', theme: ['crowd', 'interior'], hours: 'weekend', amenities: ['musica-en-vivo', 'acepta-tarjeta'], description: 'Cumbia, salsa y sonidero en vivo. Pista grande y ambiente sin pretensiones.' },
  { name: 'Wine Garden Polanco', category: 'wine-bar', type: 'bar-restaurante', price: 4, area: 'polanco', street: 'Anatole France 98', theme: ['wine', 'garden'], hours: 'afternoon', amenities: ['terraza', 'reservaciones', 'acepta-tarjeta', 'accesible', 'comida'], description: 'Más de 200 etiquetas y jardín interior. Sommelier en piso todos los días.' },
]

/** Desplazamiento determinista para no apilar bares del mismo barrio. */
function jitter(i: number) {
  const a = Math.sin(i * 12.9898) * 43758.5453
  const b = Math.sin(i * 78.233) * 12543.1234
  return [((a - Math.floor(a)) - 0.5) * 0.012, ((b - Math.floor(b)) - 0.5) * 0.012]
}

/**
 * Reparte fotos para que cada bar tenga una portada distinta mientras haya
 * existencias en su tema principal; el resto de la galería rota por temas.
 */
const usedCovers = new Set<string>()
const rotation: Record<string, number> = {}
function pickPhotos(themes: Theme[]) {
  const pool = themes.flatMap((t) => PHOTOS[t])
  const cover = pool.find((id) => !usedCovers.has(id)) ?? pool[0]
  usedCovers.add(cover)
  const rest: string[] = []
  for (let k = 0; rest.length < 4 && k < 12; k++) {
    const t = themes[k % themes.length]
    const n = (rotation[t] = (rotation[t] ?? 0) + 1)
    const id = PHOTOS[t][n % PHOTOS[t].length]
    if (id !== cover && !rest.includes(id)) rest.push(id)
  }
  return [cover, ...rest]
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Las cuentas demo se actualizan en su lugar (no se borran): pueden estar
    // referenciadas por el historial de moderación, que es de solo inserción.
    const demoHash = await hashPassword(process.env.DEMO_PASSWORD || 'barmap-demo-1')
    const upsertUser = async (name: string, email: string, role: string, status = 'active') => {
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, account_status, email_verified_at, suspended_reason)
         VALUES ($1, $2, $3, $4::user_role, $5::account_status, now(), CASE WHEN $5::account_status = 'suspended' THEN 'Demo' END)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
           account_status = EXCLUDED.account_status, suspended_reason = EXCLUDED.suspended_reason,
           email_verified_at = coalesce(users.email_verified_at, now()), token_version = users.token_version + 1
         RETURNING id`,
        [name, email, demoHash, role, status],
      )
      return rows[0].id as string
    }
    const ownerIdDemo = await upsertUser('Propietario Demo', 'owner@demo.barmap.local', 'owner')
    const adminId = await upsertUser('Admin Demo', 'admin@demo.barmap.local', 'admin')
    const applicantId = await upsertUser('Lucía Hernández', 'solicitante@demo.barmap.local', 'visitor')
    const suspendedIdDemo = await upsertUser('Propietario Suspendido', 'suspended@demo.barmap.local', 'owner', 'suspended')
    const demoIds = [ownerIdDemo, applicantId, suspendedIdDemo]

    // Fotos subidas a bares demo (si se probaron subidas): se borran del disco.
    const old = await client.query(`SELECT id FROM bars WHERE owner_id = ANY($1::uuid[])`, [demoIds])
    await Promise.all(old.rows.map((r) => fs.rm(path.join(config.uploadDir, 'bars', r.id), { recursive: true, force: true })))
    await client.query(`DELETE FROM bars WHERE owner_id = ANY($1::uuid[])`, [demoIds])
    await client.query(`DELETE FROM owner_applications WHERE user_id = ANY($1::uuid[])`, [demoIds])
    await client.query(
      `INSERT INTO owner_applications (user_id, application_status, business_name, contact_phone, verification_data,
         reviewed_by, reviewed_at, created_at)
       VALUES ($1, 'approved', 'Grupo Demo Bares', '+52 55 0000 0000', '{"city":"Ciudad de México","role":"owner"}',
         $2, now() - interval '60 days', now() - interval '61 days')`,
      [ownerIdDemo, adminId],
    )
    await client.query(
      `INSERT INTO owner_applications (user_id, business_name, contact_phone, application_notes, verification_data, created_at)
       VALUES ($1, 'Grupo Nocturno Juárez', '+52 55 1234 5678',
         'Administro dos bares en la colonia Juárez y quiero publicarlos en Barmap.',
         '{"city":"Ciudad de México","role":"owner","website":"https://example.com","instagram":"@nocturnojuarez"}', now() - interval '2 days')`,
      [applicantId],
    )
    const owner = { rows: [{ id: ownerIdDemo }] }
    const suspended = { rows: [{ id: suspendedIdDemo }] }
    const ownerId = owner.rows[0].id as string
    const suspendedId = suspended.rows[0].id as string

    const lookup = async (table: string) => {
      const { rows } = await client.query(`SELECT id, slug FROM ${table}`)
      return new Map<string, number>(rows.map((r) => [r.slug, r.id]))
    }
    const categories = await lookup('categories')
    const types = await lookup('establishment_types')
    const amenities = await lookup('amenities')

    const insertBar = async (b: SeedBar, i: number, status: string, owner: string, slugSuffix = '') => {
      const area = AREAS[b.area]
      const [dLat, dLng] = jitter(i + 1)
      const { rows } = await client.query(
        `INSERT INTO bars (owner_id, name, slug, description, category_id, type_id, address, neighborhood, city, state,
           country, postal_code, latitude, longitude, phone, website, social_links, price_range, publication_status,
           submitted_at, published_at, is_featured, verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'MX',$11,$12,$13,$14,$15,$16,$17,$18::publication_status,
           now() - interval '20 days', CASE WHEN $18::publication_status = 'published' THEN now() - ($19 || ' days')::interval END, $20,
           CASE WHEN $21 THEN now() END)
         RETURNING id`,
        [
          owner, b.name, slugify(b.name) + slugSuffix, b.description, categories.get(b.category), types.get(b.type),
          b.street, area.neighborhood, area.city, area.state, area.cp,
          (area.lat + dLat).toFixed(6), (area.lng + dLng).toFixed(6),
          `+52 55 ${String(5000 + i * 37).padStart(4, '0')} ${String(1000 + i * 91).slice(0, 4)}`,
          i % 3 === 0 ? `https://example.com/${slugify(b.name)}` : null,
          JSON.stringify(i % 2 === 0 ? { instagram: `https://instagram.com/${slugify(b.name).replace(/-/g, '')}` } : {}),
          b.price, status, String((i * 7) % 90 + 1), Boolean(b.featured), Boolean(b.verified),
        ],
      )
      const barId = rows[0].id as string

      const unique = pickPhotos(b.theme)
      for (const [k, id] of unique.entries()) {
        await client.query(
          `INSERT INTO bar_images (bar_id, storage_key, image_url, width, height, is_cover, sort_order)
           VALUES ($1, $2, $3, 1400, 933, $4, $5)`,
          [barId, `external:unsplash:${id}`, img(id), k === 0, k],
        )
      }
      for (const [day, h] of HOURS[b.hours].entries()) {
        await client.query(
          `INSERT INTO bar_hours (bar_id, day_of_week, opening_time, closing_time, is_closed) VALUES ($1,$2,$3,$4,$5)`,
          [barId, day, h?.[0] ?? null, h?.[1] ?? null, h === null],
        )
      }
      for (const slug of b.amenities) {
        const id = amenities.get(slug)
        if (id) await client.query(`INSERT INTO bar_amenities (bar_id, amenity_id) VALUES ($1,$2)`, [barId, id])
      }
      // Visitas simuladas de los últimos 30 días (para ordenar por popularidad).
      await client.query(
        `INSERT INTO bar_daily_stats (bar_id, day, views)
         SELECT $1, current_date - d, (($2::int * 13 + d * 7) % 40) + $3::int
         FROM generate_series(0, 29) d`,
        [barId, i, 5 + ((i * 7) % 30)],
      )
      return barId
    }

    for (const [i, b] of BARS.entries()) await insertBar(b, i, 'published', ownerId)

    // Bares que NUNCA deben aparecer en la API pública:
    const hidden = BARS.slice(0, 3)
    await insertBar({ ...hidden[0], name: 'Borrador Oculto' }, 100, 'draft', ownerId)
    await insertBar({ ...hidden[1], name: 'Pendiente Oculto' }, 101, 'pending_review', ownerId)
    await insertBar({ ...hidden[2], name: 'Bar De Cuenta Suspendida' }, 102, 'published', suspendedId)

    await client.query('COMMIT')
    console.log(`✔ Semilla aplicada: ${BARS.length} bares publicados + 3 ocultos de control`)
    console.log('  Cuentas demo (contraseña: DEMO_PASSWORD o "barmap-demo-1"): admin@, owner@, solicitante@demo.barmap.local')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Una revisión pendiente sobre un bar publicado, creada con los mismos
  // servicios que usa el propietario (para probar la moderación de cambios).
  try {
    const { rows } = await pool.query(`SELECT b.id, b.owner_id FROM bars b WHERE b.slug = 'la-azotea-de-colima'`)
    if (rows[0]) {
      const wc = await getWorkingCopy(rows[0].id, rows[0].owner_id)
      await saveDraft(rows[0].id, rows[0].owner_id, {
        ...wc.data,
        description: `${wc.data.description} Nuevo: cócteles sin alcohol y happy hour de 18 a 20 h.`,
        priceRange: 2,
        hours: wc.data.hours.map((h) => (h.dayOfWeek === 6 ? { ...h, isClosed: false, opens: '16:00', closes: '23:00' } : h)),
      })
      await submitForReview(rows[0].id, rows[0].owner_id)
      console.log('  + revisión pendiente en «La Azotea de Colima»')
    }
  } finally {
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('Error en semilla:', err)
  process.exit(1)
})
