# Barmap · Arquitectura

> Estado: **Etapas 1–5 completadas** (sistema de diseño; sitio público; autenticación y solicitudes; panel del propietario; panel administrativo y moderación).
> Este documento es la referencia para las etapas siguientes.

## 1. Stack

Mismo patrón que los proyectos anteriores (mantelek): SPA en React con Vite en la raíz y API Express en `server/`.

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 8 | Stack del equipo; tipado de extremo a extremo |
| Estilos | Tailwind CSS v4 (`@theme`) + CVA | Tokens en CSS, variantes tipadas, sin librería de UI pesada |
| Routing | React Router 7 (`createBrowserRouter`) | Layouts anidados: público, propietario, admin |
| Iconos | lucide-react | Consistentes, trazo ajustable, tree-shaking |
| Datos | TanStack Query | Caché, paginación y filtros sin recargar (`keepPreviousData`) |
| API | Express 5 + TypeScript + zod | Validación en servidor con los mismos esquemas |
| BD | PostgreSQL 14+ (`pg`, SQL directo) | Relacional, ENUM, CHECK, índices parciales, trigram |
| Auth | JWT (HS256) en cookie `httpOnly` + bcryptjs (coste 12) + express-rate-limit | Sin tokens en `localStorage`; revocables vía `token_version` |
| Imágenes | multer (memoria) + sharp → `lib/storage.ts` | Disco local servido en `/uploads` en dev; S3/R2 en producción implementando la misma interfaz |
| Mapas | Leaflet + react-leaflet, teselas Stadia "Alidade Smooth" | Sin key en localhost; en producción registrar dominio o `VITE_STADIA_API_KEY`. CARTO ya exige key y OSM prohíbe uso intensivo. Cambiar proveedor = cambiar `src/components/map/tiles.ts` |
| Correo | Resend vía HTTP (sin key: se imprime en la consola del servidor) | Verificación, recuperación de contraseña y decisiones de moderación |


## 2. Estructura

```
barmap/
├─ index.html · vite.config.ts · tsconfig*.json
├─ src/
│  ├─ main.tsx                 # Providers (Toast) + RouterProvider
│  ├─ router/index.tsx         # Mapa completo de rutas
│  ├─ styles/index.css         # Tokens de diseño (@theme) y utilidades
│  ├─ types/domain.ts          # Enums del dominio (espejo de los ENUM de SQL)
│  ├─ lib/                     # cn(), formateadores
│  ├─ config/env.ts
│  ├─ components/
│  │  ├─ ui/                   # Primitivas: Button, Field, Input, Badge, Modal, Toast, Stepper…
│  │  ├─ brand/                # Logo
│  │  ├─ bars/                 # BarCard, HeroSearch, CategoryRail, PriceRange, LocationPrompt
│  │  ├─ dashboard/            # StatCard (y tablas, filtros… en Etapas 4-5)
│  │  └─ layout/               # PublicLayout, Navbar, Footer, MobileTabBar, DashboardLayout
│  └─ pages/
│     ├─ public/ · owner/ · admin/ · auth/
│     └─ design/               # Guía viva del sistema de diseño (/design)
├─ server/
│  └─ src/
│     ├─ index.ts · config.ts  # Arranque y variables validadas con zod
│     ├─ db/schema.sql         # Esquema idempotente + semillas de catálogos
│     ├─ db/pool.ts · migrate.ts
│     ├─ lib/http.ts           # HttpError, asyncHandler
│     ├─ middleware/           # errorHandler (+ auth/roles en Etapa 3)
│     └─ routes/               # health (+ bars, auth, owner, admin…)
└─ docs/ARQUITECTURA.md
```

## 3. Rutas

| Zona | Ruta | Etapa |
|---|---|---|
| Pública | `/` home · `/explorar` (lista/mapa, filtros en query string) · `/bares/:slug` | 2 |
| Pública | `/favoritos` · `/ayuda` | 6 |
| Auth | `/entrar` · `/registro` · `/registra-tu-bar` (solicitud de propietario) | 3 |
| Propietario | `/panel` · `/panel/establecimientos` · `/panel/establecimientos/nuevo` · `/panel/establecimientos/:id` · `/panel/estadisticas` · `/panel/cuenta` | 3-4 |
| Admin | `/admin` · `/admin/solicitudes[/:id]` · `/admin/moderacion[/:id]` · `/admin/establecimientos` · `/admin/catalogos` · `/admin/reportes` · `/admin/historial` | 5 |
| Interna | `/design` guía del sistema de diseño | 1 |

Todas las rutas ya existen. Las que no están implementadas muestran un marcador explícito de "Etapa N" (nunca botones falsos).

### API (prefijo `/api`)

| Recurso | Acceso |
|---|---|
| `GET /bars`, `GET /bars/:slug`, `GET /catalog` | Público; **solo lee la vista `public_bars`** (implementado, Etapa 2) |
| `POST /auth/register · login · logout · verify-email · resend-verification · forgot-password · reset-password`, `GET /auth/me` | Público con límite de peticiones (implementado, Etapa 3) |
| `GET/POST /owner/application` | Sesión + correo verificado + rol `visitor` + cuenta activa (implementado) |
| `GET /admin/applications[/:id]`, `POST /admin/applications/:id/decision` | Admin activo; decisión transaccional + auditoría + notificación + correo (implementado) |
| `GET/POST /me/favorites` | Usuario autenticado (Etapa 6) |
| `/owner/overview`, `/owner/bars[/:id]`, `/owner/bars/:id/{submit,revision,images,images/order}`, `/owner/geocode` | `role=owner` (lectura aunque esté suspendida; escritura solo activa) **y** `owner_id = req.user.id` en cada consulta → 404 si no es suyo (implementado, Etapa 4) |
| `/admin/overview`, `/admin/moderation`, `/admin/bars[/:id]`, `/admin/bars/:id/{decision,visibility}`, `PUT /admin/bars/:id`, `/admin/users[/:id]`, `/admin/users/:id/status`, `/admin/catalog/:kind[/:id]`, `/admin/logs` | `role=admin` activo; cada acción escribe en `moderation_logs` dentro de la misma transacción (implementado, Etapa 5) |
| `GET /geocode` | `owner` o `admin` activos |

### Búsqueda pública (`GET /api/bars`)

Parámetros (validados con zod; los mismos nombres que la URL de `/explorar`):
`q`, `donde`, `categoria`, `precio=1,2`, `servicios=terraza,wifi` (todos requeridos), `abierto=1`,
`lat`, `lng`, `radio` (km), `bbox=minLat,minLng,maxLat,maxLng`, `orden` (relevance · recommended · popular · distance · newest), `page`, `pageSize` (≤ 100).

- Texto: `ILIKE` + `unaccent` sobre nombre, colonia, categoría, tipo y descripción; relevancia con `pg_trgm.similarity`.
- Distancia: haversine en SQL; sin coordenadas, `orden=distance` degrada a `popular` (la respuesta indica el orden efectivo).
- "Abierto ahora": función SQL `bar_open_state()` en la zona horaria del bar, con horarios que cruzan medianoche.
- Popularidad: visitas de los últimos 30 días (`bar_daily_stats`) + 5 × favoritos.
- Borradores, pendientes, suspendidos y bares de cuentas suspendidas responden **404**, igual que un slug inexistente.

Escalabilidad: la búsqueda textual con `unaccent` no usa índice; con miles de bares, agregar columna generada normalizada + índice trigram, o PostGIS para geo.

### Autenticación y roles (Etapa 3)

- **Sesión**: cookie `barmap_session` (`httpOnly`, `SameSite=Lax`, `Secure` en producción) con un JWT `{sub, tv}`. En cada petición `authenticate` carga el usuario **desde la BD**; si `tv` ≠ `token_version` la sesión se invalida (restablecer contraseña o suspender incrementa la versión).
- **CSRF**: además de SameSite, las mutaciones exigen `Content-Type: application/json` y un `Origin` de la lista blanca (`CLIENT_ORIGIN`).
- **Roles**: registrarse siempre crea `visitor`. `owner` solo se obtiene cuando un admin aprueba una solicitud; `admin` solo con `npm run create-admin` (acceso a BD). `requireRole()` exige además cuenta activa.
- **Antienumeración**: el login responde igual si el correo no existe (y compara contra un hash ficticio para igualar tiempos); "olvidé mi contraseña" siempre responde OK.
- **Antispam**: límites por IP (login: 10 fallidos / 15 min; registro: 5 / h; correos: 5 / h; solicitudes: 5 / día) y campo trampa `website_url`.
- **Tokens de un solo uso**: 32 bytes aleatorios; solo se guarda su SHA-256; consumo atómico (`UPDATE … RETURNING`). Verificación: 48 h; recuperación: 1 h.
- **Flujo del propietario**: registro → verificación de correo → `/registra-tu-bar` (formulario) → `pending` → admin aprueba (rol `owner`) o rechaza con motivo (visible para el usuario y enviado por correo) → puede corregir y reenviar.

### Panel del propietario (Etapa 4)

- **Copia de trabajo** (`services/ownerBars.ts`): `GET /owner/bars/:id` devuelve los datos editables, las fotos en orden (la primera es la portada), el estado, la revisión abierta, el motivo de bloqueo y posibles duplicados (mismo nombre y ciudad, solo entre bares publicados o propios).
- **Bar nunca publicado** (`draft`, `changes_requested`, `rejected`): se edita la fila de `bars`; el slug sigue al nombre hasta la primera publicación. Solo estos se pueden eliminar.
- **Bar publicado**: guardar crea o actualiza la revisión abierta (`bar_revisions.snapshot` = campos + `imageIds`). Las fotos nuevas se guardan con `revision_id` y **no son públicas**; quitar una foto pública solo la saca de la propuesta. Al enviar se calculan `changed_fields` con comparación de claves ordenadas (JSONB reordena las claves). Si no hay cambios, responde 422.
- **Bloqueos**: `pending_review`, `suspended` o una revisión `pending_review` → 409 en cualquier escritura.
- **Envío**: `validateForSubmit` exige nombre, descripción de 40 caracteres o más, categoría, tipo, dirección, ciudad, estado, coordenadas, precio, al menos un día abierto con horas, un medio de contacto y al menos 3 fotos. Además, la BD tiene el CHECK `bars_complete_when_submitted`.
- **Fotos**: 8 MB máximo y entre 3 y 12 por bar. El formato se detecta por el contenido (JPG, PNG, WebP o HEIC) y el mínimo es 1000×600. Se rota según EXIF, **se eliminan todos los metadatos** (incluido el GPS) y se recodifica a WebP en dos tamaños: 2000 px y miniatura de 720 px. Las subidas multipart solo se aceptan con un `Origin` permitido. Se comprueban permisos y cupo antes de leer el archivo.
- **Geocodificación**: proxy a Nominatim con User-Agent propio, límite de frecuencia y caché de 24 h. Si falla, el pin se coloca a mano en el mapa. En producción conviene un proveedor con contrato.
- **UI**: alta en 5 pasos con indicador de progreso. Validación por paso (las mismas reglas que el servidor), guardado de borrador, aviso de cambios sin guardar (al navegar y al cerrar la pestaña), vista previa con la misma vista pública, confirmación antes de enviar y avisos de estado con el comentario del admin.

### Moderación y administración (Etapa 5)

- **Cola** (`/admin/moderacion`): bares nuevos (`pending_review`) y revisiones de bares publicados, del más antiguo al más reciente, con posible duplicado y propietario suspendido señalados.
- **Revisión** (`/admin/moderacion/:id`): datos completos, fotos, mapa y propietario. En una revisión, comparación campo por campo (solo los días de horario que cambian; la ubicación se muestra con la distancia que se mueve el pin) y de fotos (nuevas, quitadas y nuevo orden).
- **Decisiones** (`services/moderation.ts`): aprobar, rechazar o pedir cambios. Rechazar o pedir cambios exige un comentario de 10 caracteres o más, visible para el propietario. Cada decisión bloquea la fila, verifica el estado previo (409 si ya se decidió), registra la auditoría, crea una notificación y envía el correo después del COMMIT.
  - **Aprobar un bar nuevo**: exige propietario `owner` activo y datos completos; asigna la portada y `published_at`.
  - **Aprobar una revisión**: exige que `base_version` coincida con `bars.version`. Si no (p. ej. el admin editó en medio), responde 409 `outdated`. Aplica la propuesta (`writeLive`), hace públicas las fotos nuevas en su orden, borra las fotos retiradas (filas y archivos) e incrementa `version`.
  - **Rechazar una revisión**: la cierra y borra sus fotos, que nunca fueron públicas. La versión publicada no cambia.
- **Visibilidad**: suspender (con motivo) o reactivar una publicación.
- **Edición del admin**: corrige los campos de la versión vigente, incrementa `version`, guarda en la auditoría los campos cambiados y sus valores anteriores, y notifica al propietario. Las fotos solo las gestiona el propietario.
- **Usuarios**: listado con filtros por rol y estado, búsqueda y orden. Suspender (con motivo) incrementa `token_version`, lo que cierra todas sus sesiones, y sus bares salen de `public_bars`. No se puede aplicar a uno mismo ni a otros admins.
- **Catálogos**: crear, renombrar (el slug no cambia), cambiar icono, ordenar y activar/desactivar. Solo se puede eliminar lo que no está en uso.
- **Historial** (`/admin/historial`): `moderation_logs` con filtros por tipo, acción, texto y fechas, y enlace a cada entidad.

## 4. Modelo de datos

Definido en [`server/src/db/schema.sql`](../server/src/db/schema.sql). Entidades:

- **users**: `role` (visitor · owner · admin), `account_status` (active · suspended), `email_verified_at`, `token_version`.
- **auth_tokens**: verificación de correo y restablecimiento de contraseña (solo se guarda el hash).
- **owner_applications**: `pending` · `approved` · `rejected`. Índice único parcial: una sola solicitud pendiente por usuario. CHECK: un rechazo exige motivo. `verification_data` (jsonb) queda preparado para la verificación de propiedad.
- **categories · establishment_types · amenities**: catálogos gestionables por el admin (con semillas).
- **bars**: versión vigente del establecimiento. `publication_status` con 6 estados. CHECK `bars_complete_when_submitted`: no se puede enviar ni publicar un bar sin categoría, dirección, coordenadas y precio. Campos de monetización (`is_featured`, `featured_until`, `verified_at`) sin uso en el MVP.
- **bar_images** (una sola portada por bar vía índice parcial; `thumb_url`; `revision_id` para fotos de una revisión no aprobada), **bar_hours** (0 = lunes; cierre después de medianoche si `closing <= opening`), **bar_amenities**.
- **bar_revisions**: versionado de bares publicados (ver §5).
- **favorites · reports · notifications · bar_daily_stats** (analítica agregada, sin datos personales).
- **moderation_logs**: auditoría; un trigger impide UPDATE y DELETE.
- **Vista `public_bars`**: publicado, no eliminado, propietario con `role='owner'` y cuenta activa. Sin email ni campos internos.

## 5. Flujo de moderación y versionado

```
draft ──enviar──▶ pending_review ──admin──▶ published
  ▲                      │                      │
  │                      ├──▶ changes_requested ─┘(corrige y reenvía → pending_review)
  │                      └──▶ rejected (puede corregir y reenviar)
  │
published ──admin──▶ suspended ──admin──▶ published
```

- **Bar nunca publicado**: el propietario edita directamente la fila de `bars` mientras está en `draft`, `changes_requested` o `rejected`. Mientras está en `pending_review` no se puede editar.
- **Bar publicado**: cualquier edición crea (o actualiza) una fila en `bar_revisions` con un `snapshot` completo. El público sigue viendo la versión vigente. Al enviarla pasa a `pending_review`; el admin ve un diff campo por campo (`changed_fields` + snapshot frente a la fila vigente). Si la aprueba, se copia a `bars` en una transacción y `version` se incrementa. Si `base_version` no coincide (hubo otra aprobación en medio), se marca `superseded`.
- Las transiciones se implementan en el servidor como una **máquina de estados**: tabla de transiciones permitidas por rol. El cliente nunca envía el estado destino, solo la acción (`submit`, `approve`, `reject`, `request_changes`, `suspend`).

## 6. Seguridad (reglas no negociables)

1. **El servidor decide.** Rol, estado y `owner_id` se leen de la BD en cada petición, nunca del cuerpo de la petición. zod usa `.strict()` para rechazar campos como `publication_status` o `role`.
2. **Propiedad en la consulta**: `UPDATE bars … WHERE id = $1 AND owner_id = $2`. Si no hay filas afectadas, se responde 404 (no 403, para no revelar que el recurso existe).
3. **Estado de la cuenta en cada petición**: el middleware carga el usuario. Si está suspendido, las rutas de gestión devuelven 403. Si `token_version` no coincide, el JWT deja de ser válido.
4. **Endpoints públicos solo contra `public_bars`**, con serializadores explícitos (nunca `SELECT *` hacia el cliente).
5. **Auditoría transaccional**: cambio de estado y `moderation_logs` en el mismo `BEGIN … COMMIT`.
6. **Imágenes**: tipo real verificado con sharp (no por extensión), JPG/PNG/WebP, máx. 8 MB, se recodifican a WebP y se eliminan los metadatos EXIF (incluida la ubicación GPS).
7. **Antispam**: límite de peticiones en auth, solicitudes y reportes. Campo honeypot en formularios públicos. Correo verificado antes de solicitar acceso como propietario.
8. **Contraseñas** con bcrypt (coste 12). Cookies `httpOnly`, `Secure` y `SameSite=Lax`. CORS con lista blanca de orígenes.

## 7. Sistema de diseño

Guía viva en **`/design`**. Resumen:

- **Acento "Mezcal"** `#C93D14` (brand-600, contraste 5.05:1 AA). Escala `brand-50…900`.
- **Neutros "ink"** cálidos (`#17151F` a `#F7F6F3`). Colores semánticos: success, warning, danger e info.
- **Tipografía**: Bricolage Grotesque en titulares y Plus Jakarta Sans en la interfaz.
- **Forma**: radios de 12–24 px, sombras en capas muy suaves, controles de 44–48 px de alto.
- **Estados**: cada estado de publicación tiene etiqueta, color, punto y descripción, definidos en un único lugar (`StatusBadge.tsx`).
- **Móvil primero**: barra de pestañas inferior, buscador apilado, modales en forma de hoja inferior y tablas que se convierten en tarjetas.
- **Accesibilidad**: `:focus-visible` en todos los controles, `aria-*` automáticos en `Field`, soporte de `prefers-reduced-motion` y texto en cada estado (nunca solo color).

## 8. Datos de desarrollo

`npm run seed` crea cuentas demo (`admin@`, `owner@`, `solicitante@`, `suspended@demo.barmap.local`; contraseña `DEMO_PASSWORD` o `barmap-demo-1`) y 26 bares ficticios publicados en 6 ciudades, más 3 bares de control que **no** deben verse (borrador, en revisión y de cuenta suspendida) y una revisión pendiente en «La Azotea de Colima» para probar la moderación de cambios. Se niega a correr con `NODE_ENV=production`. Las fotos son de Unsplash por URL; desde la Etapa 4 las imágenes reales se suben al almacenamiento propio.

## 9. Etapas

1. ✅ Arquitectura, estructura y sistema de diseño
2. ✅ Home pública, buscador, tarjetas, mapa (lista/mapa, agrupación, "buscar en esta zona") y detalle con SEO (título, OG, JSON-LD)
3. ✅ Auth, roles, verificación de correo, recuperación de contraseña, solicitud de propietarios y su revisión por el admin
4. ✅ Panel del propietario (resumen, listado, alta y edición en 5 pasos, fotos, mapa, vista previa, envío a revisión y revisiones de bares publicados)
5. ✅ Panel de administración: resumen, cola de moderación, comparación de revisiones, decisiones, suspensión de bares y cuentas, edición, catálogos e historial
6. Mapa completo, filtros avanzados, favoritos, reportes, notificaciones y analítica
7. Revisión de seguridad, pruebas, rendimiento y SEO (Open Graph, JSON-LD `BarOrPub`)
