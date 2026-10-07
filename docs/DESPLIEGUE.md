# Barmap · Guía de despliegue

Barmap se despliega como **un solo servicio Node** (API + sitio compilado) más una base de datos **PostgreSQL 14+**. Sirve en cualquier proveedor que ejecute Node 20+: Render, Railway, Fly.io o un VPS.

```
Navegador ──HTTPS──▶ Node (Express)
                       ├─ /api/*        API
                       ├─ /bares/:slug  HTML con metadatos SEO
                       ├─ /assets/*     Frontend compilado (Vite)
                       └─ /uploads/*    Fotos (solo con almacenamiento local)
                      │
                      └─▶ PostgreSQL
```

## 1. Requisitos

| Servicio | Para qué | Obligatorio |
|---|---|---|
| Node 20+ | Servidor | Sí |
| PostgreSQL 14+ con extensiones `citext`, `pg_trgm` y `unaccent` (vienen en la mayoría de proveedores gestionados) | Datos | Sí |
| Dominio con HTTPS | Cookies seguras (`Secure`) y SEO | Sí |
| Resend (u otro proveedor configurado en `lib/mailer.ts`) | Verificación de correo, recuperación y avisos | Sí, para que los usuarios reciban correos |
| Stadia Maps (registrar el dominio o usar API key) | Teselas del mapa | Sí en producción |
| Disco persistente **o** S3/R2 | Fotos subidas por propietarios | Sí (ver §5) |

## 2. Variables de entorno (servidor)

Copia `server/.env.example`. En producción:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL |
| `DATABASE_SSL` | `true` si el proveedor lo exige (Render, Neon…) |
| `JWT_SECRET` | **Obligatorio**, 32 caracteres o más: `openssl rand -hex 32`. Cambiarlo cierra todas las sesiones |
| `APP_URL` | URL pública, p. ej. `https://barmap.mx` (enlaces de correos, canonical, sitemap) |
| `CLIENT_ORIGIN` | Igual que `APP_URL` (orígenes permitidos, separados por coma) |
| `PORT` | Lo asigna el proveedor (por defecto 4000) |
| `TRUST_PROXY` | `1` detrás del balanceador del proveedor |
| `RESEND_API_KEY` · `MAIL_FROM` | Clave y remitente de un dominio verificado, p. ej. `Barmap <hola@barmap.mx>` |
| `UPLOAD_DIR` · `UPLOAD_PUBLIC_URL` · `MAX_UPLOAD_MB` | Ver §5 |
| `CLIENT_DIST` | `../dist` (valor por defecto) |

Variables del **frontend**, que se fijan al compilar (`.env` en la raíz):

| Variable | Valor |
|---|---|
| `VITE_API_BASE_URL` | Vacío (mismo dominio) |
| `VITE_STADIA_API_KEY` | Clave de Stadia (opcional si se registra el dominio) |
| `VITE_SUPPORT_EMAIL` | Correo que se muestra en el Centro de ayuda |

## 3. Compilar y arrancar

```bash
npm ci && npm --prefix server ci
npm run build:all                 # frontend → dist/ · servidor → server/dist/
npm --prefix server run migrate:prod   # aplica el esquema (idempotente)
npm start                         # node server/dist/index.js
```

En un proveedor tipo Render o Railway:
- **Build:** `npm ci && npm --prefix server ci && npm run build:all`
- **Pre-deploy / release:** `npm --prefix server run migrate:prod`
- **Start:** `npm start`
- **Health check:** `GET /api/health`, que responde 200 si la base de datos responde.

`npm run seed` se niega a correr con `NODE_ENV=production`. No cargues datos demo en producción.

## 4. Primer administrador

El rol admin **no** se puede obtener desde la web. Con acceso a la base de datos:

```bash
ADMIN_PASSWORD='una-contraseña-larga' npm --prefix server run create-admin:prod -- --email tu@correo.com --name "Tu Nombre"
```

Sin `ADMIN_PASSWORD` se genera una contraseña segura y se muestra **una sola vez**.

## 5. Fotos

- **Opción A, disco persistente** (VPS o disco montado en Render/Railway): `UPLOAD_DIR=/data/uploads`, `UPLOAD_PUBLIC_URL=/uploads`. Respalda esa carpeta.
- **Opción B, S3 o Cloudflare R2** (recomendada si hay varias instancias o el disco es efímero): implementar la interfaz `Storage` de `server/src/lib/storage.ts` con `PutObject` y `DeleteObject`, y poner en `UPLOAD_PUBLIC_URL` la URL pública del bucket o CDN. Hay que añadir ese dominio a `img-src` en la CSP de `server/src/app.ts`.

## 6. Comprobaciones tras el despliegue

```bash
curl -s https://TU_DOMINIO/api/health                       # {"ok":true,...,"database":"ok"}
curl -sI https://TU_DOMINIO/ | grep -i content-security     # CSP presente
curl -s https://TU_DOMINIO/bares/<slug> | grep og:title      # metadatos SEO en el HTML
curl -s https://TU_DOMINIO/sitemap.xml | head -3
```

En el navegador:
1. Registrarte y recibir el correo de verificación.
2. Solicitar acceso de propietario.
3. Aprobar la solicitud desde `/admin`.
4. Registrar un bar con fotos, enviarlo y aprobarlo.
5. Comprobar que aparece en `/explorar` y en el mapa.

## 7. Operación

- **Respaldos**: copia diaria de PostgreSQL (la mayoría de proveedores la incluyen) y de las fotos si se usa disco.
- **Logs**: los errores 500 se registran con `[error]`; los correos fallidos con `[mail]`.
- **Límites de peticiones**: están en memoria por instancia. Con más de una instancia, usar un almacén compartido para `express-rate-limit` (p. ej. `rate-limit-redis`).
- **Actualizaciones**: el esquema es idempotente, así que basta con volver a ejecutar `migrate:prod` en cada despliegue.
- **Pruebas antes de desplegar**: `npm test`. Necesita PostgreSQL local y usa la base desechable `barmap_test`.

## Pendientes antes del lanzamiento

Dependen de cuentas o decisiones externas:

1. Elegir proveedor de fotos (disco persistente o S3/R2) y, si es S3/R2, implementar el adaptador (§5).
2. Cuenta de Resend con dominio verificado y `MAIL_FROM` propio.
3. Registrar el dominio en Stadia Maps o configurar `VITE_STADIA_API_KEY`.
4. Proveedor de geocodificación con contrato. Hoy se usa Nominatim (OpenStreetMap), con límite de uso; el proxy está en `server/src/routes/geocode.ts`.
5. Almacén compartido para los límites de peticiones si habrá más de una instancia.
6. Revisión legal de `/legal/terminos` y `/legal/privacidad` (razón social, domicilio, contacto ARCO).
7. Definir `VITE_SUPPORT_EMAIL`.
8. Crear el primer administrador real (§4).
9. Decidir si el admin puede gestionar fotos directamente (hoy solo puede pedir cambios o suspender la publicación).
