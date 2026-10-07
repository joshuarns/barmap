import fs from 'node:fs'
import path from 'node:path'
import express, { type Express, type Request, type Response } from 'express'
import { config } from '../config.js'
import { query } from '../db/pool.js'

/**
 * Sirve el frontend compilado (si existe CLIENT_DIST) desde el mismo servidor:
 * - assets con caché inmutable; index.html sin caché
 * - /bares/:slug con metadatos SEO en el HTML (título, descripción, Open Graph,
 *   canonical y JSON-LD) para buscadores y vistas previas al compartir, que no
 *   ejecutan JavaScript
 * - sitemap.xml y robots.txt
 * - cualquier otra ruta → index.html (SPA)
 */
export function mountClient(app: Express) {
  const indexFile = path.join(config.clientDist, 'index.html')
  if (!fs.existsSync(indexFile)) return
  const template = fs.readFileSync(indexFile, 'utf8')
  const site = config.appUrl

  app.use('/assets', express.static(path.join(config.clientDist, 'assets'), { maxAge: '1y', immutable: true, fallthrough: false }))
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }))

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /admin\nDisallow: /cuenta\nDisallow: /api/\nSitemap: ${site}/sitemap.xml\n`)
  })

  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const { rows } = await query(`SELECT slug, updated_at FROM public_bars ORDER BY updated_at DESC LIMIT 45000`)
      const urls = [
        `<url><loc>${site}/</loc><changefreq>daily</changefreq></url>`,
        `<url><loc>${site}/explorar</loc><changefreq>daily</changefreq></url>`,
        `<url><loc>${site}/registra-tu-bar</loc></url>`,
        `<url><loc>${site}/ayuda</loc></url>`,
        ...rows.map((r) => `<url><loc>${site}/bares/${r.slug}</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0, 10)}</lastmod></url>`),
      ]
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600')
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`)
    } catch (err) {
      next(err)
    }
  })

  app.get('/bares/:slug', async (req, res, next) => {
    try {
      const slug = String(req.params.slug)
      const bar = /^[a-z0-9-]{1,120}$/.test(slug)
        ? (await query(
            `SELECT pb.slug, pb.name, pb.description, pb.address, pb.neighborhood, pb.city, pb.state, pb.postal_code, pb.country, pb.latitude, pb.longitude,
                    pb.phone, pb.price_range, c.name AS category,
                    (SELECT image_url FROM bar_images i WHERE i.bar_id = pb.id AND i.revision_id IS NULL ORDER BY is_cover DESC, sort_order LIMIT 1) AS image
             FROM public_bars pb LEFT JOIN categories c ON c.id = pb.category_id WHERE pb.slug = $1`,
            [slug],
          )).rows[0]
        : null
      if (!bar) return sendIndex(res, { title: 'Bar no disponible · Barmap', noindex: true }, 404)
      const url = `${site}/bares/${bar.slug}`
      const image = bar.image ? (bar.image.startsWith('http') ? bar.image : `${site}${bar.image}`) : undefined
      const description = (bar.description ?? `${bar.category ?? 'Bar'} en ${bar.city}`).slice(0, 155)
      sendIndex(res, {
        title: `${bar.name} · ${bar.category ?? 'Bar'} en ${bar.neighborhood ?? bar.city} · Barmap`,
        description,
        url,
        image,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'BarOrPub',
          name: bar.name,
          description: bar.description ?? undefined,
          url,
          image,
          telephone: bar.phone ?? undefined,
          priceRange: bar.price_range ? '$'.repeat(bar.price_range) : undefined,
          address: { '@type': 'PostalAddress', streetAddress: bar.address, addressLocality: bar.city, addressRegion: bar.state, postalCode: bar.postal_code, addressCountry: bar.country },
          geo: { '@type': 'GeoCoordinates', latitude: Number(bar.latitude), longitude: Number(bar.longitude) },
        },
      })
    } catch (err) {
      next(err)
    }
  })

  app.get(/^\/(?!api\/|uploads\/).*/, (req: Request, res: Response) => {
    const privateArea = /^\/(panel|admin|cuenta|entrar|registro)/.test(req.path)
    sendIndex(res, { noindex: privateArea })
  })

  function sendIndex(res: Response, meta: { title?: string; description?: string; url?: string; image?: string; noindex?: boolean; jsonLd?: object }, status = 200) {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    let html = template
    const head: string[] = []
    if (meta.title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    if (meta.description) {
      html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(meta.description)}" />`)
      head.push(`<meta property="og:description" content="${esc(meta.description)}" />`)
    }
    if (meta.title) head.push(`<meta property="og:title" content="${esc(meta.title)}" />`, `<meta property="og:type" content="website" />`)
    if (meta.url) head.push(`<link rel="canonical" href="${esc(meta.url)}" />`, `<meta property="og:url" content="${esc(meta.url)}" />`)
    if (meta.image) head.push(`<meta property="og:image" content="${esc(meta.image)}" />`, `<meta name="twitter:card" content="summary_large_image" />`)
    if (meta.noindex) head.push(`<meta name="robots" content="noindex" />`)
    // JSON-LD: se escapa "<" para que nunca pueda cerrar la etiqueta script.
    if (meta.jsonLd) head.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`)
    html = html.replace('</head>', `${head.join('\n    ')}\n  </head>`)
    res.status(status).type('html').set('Cache-Control', 'no-cache').send(html)
  }
}
