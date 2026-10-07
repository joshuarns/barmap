-- =====================================================================
-- Barmap · esquema relacional (PostgreSQL 14+)
-- Idempotente: se puede ejecutar varias veces (npm run migrate).
-- Las reglas de negocio críticas se refuerzan aquí además de en la API:
--   · CHECKs y ENUMs para estados válidos
--   · vista public_bars: única fuente para endpoints públicos
--   · moderation_logs es de solo inserción (trigger)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('visitor', 'owner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE publication_status AS ENUM (
    'draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estado de una revisión de cambios sobre un bar ya publicado.
DO $$ BEGIN
  CREATE TYPE revision_status AS ENUM (
    'draft', 'pending_review', 'approved', 'changes_requested', 'rejected', 'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auth_token_purpose AS ENUM ('email_verification', 'password_reset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('wrong_info', 'closed_permanently', 'inappropriate', 'duplicate', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moderation_entity AS ENUM (
    'user', 'owner_application', 'bar', 'bar_revision', 'report', 'category', 'establishment_type', 'amenity'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Usuarios y autenticación
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email             citext      NOT NULL UNIQUE,
  password_hash     text        NOT NULL,
  role              user_role   NOT NULL DEFAULT 'visitor',
  account_status    account_status NOT NULL DEFAULT 'active',
  suspended_reason  text,
  email_verified_at timestamptz,
  -- Se incrementa al suspender o cambiar contraseña: invalida JWT emitidos.
  token_version     integer     NOT NULL DEFAULT 0,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users (role, account_status);
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tokens de un solo uso. Se guarda solo el hash (sha256) del token.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     auth_token_purpose NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens (user_id, purpose);

-- ---------------------------------------------------------------------
-- Solicitudes de propietario
-- Un usuario pasa a role='owner' solo cuando un admin aprueba su solicitud.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_status application_status NOT NULL DEFAULT 'pending',
  business_name      text NOT NULL CHECK (char_length(business_name) BETWEEN 2 AND 160),
  contact_phone      text NOT NULL CHECK (char_length(contact_phone) BETWEEN 7 AND 25),
  application_notes  text CHECK (char_length(application_notes) <= 2000),
  -- Verificación de propiedad (fase posterior): documento, sitio web, redes...
  verification_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by        uuid REFERENCES users(id),
  reviewed_at        timestamptz,
  rejection_reason   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (application_status <> 'rejected' OR rejection_reason IS NOT NULL),
  CHECK (application_status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
-- Como máximo una solicitud pendiente por usuario (se permite reintentar tras un rechazo).
CREATE UNIQUE INDEX IF NOT EXISTS owner_applications_one_pending
  ON owner_applications (user_id) WHERE application_status = 'pending';
CREATE INDEX IF NOT EXISTS owner_applications_status_idx ON owner_applications (application_status, created_at DESC);
DROP TRIGGER IF EXISTS owner_applications_updated_at ON owner_applications;
CREATE TRIGGER owner_applications_updated_at BEFORE UPDATE ON owner_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Catálogos gestionables por el admin
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon       text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS establishment_types (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS amenities (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon       text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------
-- Establecimientos
-- La fila de `bars` contiene la versión VIGENTE. Si el bar nunca se ha
-- publicado, el propietario la edita directamente. Si ya está publicado,
-- los cambios van a `bar_revisions` y solo se copian aquí al aprobarse.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bars (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES users(id),
  name               text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug               text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description        text CHECK (char_length(description) <= 1200),
  category_id        integer REFERENCES categories(id),
  type_id            integer REFERENCES establishment_types(id),
  -- Ubicación
  address            text,
  neighborhood       text,
  city               text,
  state              text,
  country            text NOT NULL DEFAULT 'MX',
  postal_code        text,
  latitude           numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude          numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  -- Contacto
  phone              text,
  website            text,
  social_links       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { instagram, facebook, tiktok, x }
  price_range        smallint CHECK (price_range BETWEEN 1 AND 4),
  -- Moderación
  publication_status publication_status NOT NULL DEFAULT 'draft',
  moderation_note    text,          -- último comentario del admin visible para el propietario
  submitted_at       timestamptz,
  published_at       timestamptz,
  version            integer NOT NULL DEFAULT 1,
  -- Preparado para monetización (sin uso en el MVP)
  is_featured        boolean NOT NULL DEFAULT false,
  featured_until     timestamptz,
  verified_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  -- Para enviar a revisión o publicar, los datos mínimos deben existir.
  CONSTRAINT bars_complete_when_submitted CHECK (
    publication_status = 'draft' OR (
      category_id IS NOT NULL AND address IS NOT NULL AND city IS NOT NULL
      AND latitude IS NOT NULL AND longitude IS NOT NULL AND price_range IS NOT NULL
    )
  )
);
-- Zona horaria del establecimiento (para calcular "abierto ahora").
ALTER TABLE bars ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Mexico_City';

CREATE INDEX IF NOT EXISTS bars_owner_idx ON bars (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bars_status_idx ON bars (publication_status, submitted_at);
CREATE INDEX IF NOT EXISTS bars_city_idx ON bars (lower(city)) WHERE publication_status = 'published';
CREATE INDEX IF NOT EXISTS bars_geo_idx ON bars (latitude, longitude) WHERE publication_status = 'published';
CREATE INDEX IF NOT EXISTS bars_name_trgm_idx ON bars USING gin (name gin_trgm_ops);
-- Detección de duplicados evidentes (misma dirección y nombre en la ciudad).
CREATE INDEX IF NOT EXISTS bars_dupe_idx ON bars (lower(name), lower(city)) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS bars_updated_at ON bars;
CREATE TRIGGER bars_updated_at BEFORE UPDATE ON bars FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bar_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id      uuid NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  storage_key text NOT NULL,     -- clave en el almacenamiento (local / S3 / R2)
  image_url   text NOT NULL,
  width       integer,
  height      integer,
  is_cover    boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bar_images_bar_idx ON bar_images (bar_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS bar_images_one_cover ON bar_images (bar_id) WHERE is_cover;

-- day_of_week: 0 = lunes … 6 = domingo. Si closing_time <= opening_time,
-- el cierre es al día siguiente (p. ej. 20:00 → 02:00).
CREATE TABLE IF NOT EXISTS bar_hours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id       uuid NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opening_time time,
  closing_time time,
  is_closed    boolean NOT NULL DEFAULT false,
  UNIQUE (bar_id, day_of_week),
  CHECK (is_closed OR (opening_time IS NOT NULL AND closing_time IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS bar_amenities (
  bar_id     uuid    NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  amenity_id integer NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (bar_id, amenity_id)
);

-- ---------------------------------------------------------------------
-- Revisiones de bares publicados (versionado)
-- snapshot: copia completa propuesta { name, description, ..., hours[], amenityIds[], images[] }
-- El admin compara snapshot vs. la fila vigente de `bars` antes de aprobar.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bar_revisions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id         uuid NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  author_id      uuid NOT NULL REFERENCES users(id),
  base_version   integer NOT NULL,   -- versión de `bars` sobre la que se editó
  status         revision_status NOT NULL DEFAULT 'draft',
  snapshot       jsonb NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  submitted_at   timestamptz,
  reviewed_by    uuid REFERENCES users(id),
  reviewed_at    timestamptz,
  review_comment text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- Una sola revisión abierta por bar.
CREATE UNIQUE INDEX IF NOT EXISTS bar_revisions_one_open
  ON bar_revisions (bar_id) WHERE status IN ('draft', 'pending_review', 'changes_requested');
CREATE INDEX IF NOT EXISTS bar_revisions_queue_idx ON bar_revisions (status, submitted_at);
DROP TRIGGER IF EXISTS bar_revisions_updated_at ON bar_revisions;
CREATE TRIGGER bar_revisions_updated_at BEFORE UPDATE ON bar_revisions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Interacción pública
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bar_id     uuid NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bar_id)
);
CREATE INDEX IF NOT EXISTS favorites_bar_idx ON favorites (bar_id);

CREATE TABLE IF NOT EXISTS reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id        uuid NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  reporter_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  reporter_hash text,               -- hash de IP para limitar abuso anónimo
  reason        report_reason NOT NULL,
  details       text CHECK (char_length(details) <= 1000),
  status        report_status NOT NULL DEFAULT 'open',
  resolved_by   uuid REFERENCES users(id),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);

-- Analítica agregada por día (sin datos personales).
CREATE TABLE IF NOT EXISTS bar_daily_stats (
  bar_id           uuid NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  day              date NOT NULL,
  views            integer NOT NULL DEFAULT 0,
  direction_clicks integer NOT NULL DEFAULT 0,
  shares           integer NOT NULL DEFAULT 0,
  favorites_added  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bar_id, day)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,        -- p. ej. 'application.approved', 'bar.changes_requested'
  title      text NOT NULL,
  body       text,
  link       text,
  read_at    timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read_at, created_at DESC);

-- ---------------------------------------------------------------------
-- Auditoría (solo inserción)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_logs (
  id              bigserial PRIMARY KEY,
  admin_id        uuid NOT NULL REFERENCES users(id),
  entity_type     moderation_entity NOT NULL,
  entity_id       text NOT NULL,
  action          text NOT NULL,    -- approve, reject, request_changes, suspend, reactivate, edit, hide...
  previous_status text,
  new_status      text,
  comment         text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_logs_entity_idx ON moderation_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_logs_admin_idx ON moderation_logs (admin_id, created_at DESC);

CREATE OR REPLACE FUNCTION forbid_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'moderation_logs es de solo inserción';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS moderation_logs_immutable ON moderation_logs;
CREATE TRIGGER moderation_logs_immutable BEFORE UPDATE OR DELETE ON moderation_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_log_mutation();

-- ---------------------------------------------------------------------
-- ¿Está abierto? Calculado en la zona horaria del bar. Considera horarios
-- que cruzan la medianoche (el turno del día anterior sigue abierto).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bar_open_state(p_bar uuid, p_tz text, p_at timestamptz DEFAULT now())
RETURNS TABLE (is_open boolean, closes_at time, has_hours boolean)
LANGUAGE sql STABLE AS $$
  WITH l AS (
    SELECT (extract(isodow FROM p_at AT TIME ZONE p_tz)::int - 1) AS dow,
           (p_at AT TIME ZONE p_tz)::time AS t
  ), m AS (
    SELECT h.closing_time
    FROM bar_hours h, l
    WHERE h.bar_id = p_bar AND NOT h.is_closed AND (
      (h.day_of_week = l.dow AND (
        (h.opening_time < h.closing_time AND l.t >= h.opening_time AND l.t < h.closing_time)
        OR (h.closing_time <= h.opening_time AND l.t >= h.opening_time)))
      OR (h.day_of_week = (l.dow + 6) % 7 AND h.closing_time <= h.opening_time AND l.t < h.closing_time)
    )
    LIMIT 1
  )
  SELECT EXISTS (SELECT 1 FROM m),
         (SELECT closing_time FROM m),
         EXISTS (SELECT 1 FROM bar_hours WHERE bar_id = p_bar)
$$;

-- ---------------------------------------------------------------------
-- Vista pública: la ÚNICA fuente que usan los endpoints públicos.
-- Solo bares publicados, no eliminados, de propietarios activos.
-- No expone datos del propietario ni campos internos de moderación.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public_bars AS
SELECT
  b.id, b.slug, b.name, b.description,
  b.category_id, b.type_id,
  b.address, b.neighborhood, b.city, b.state, b.country, b.postal_code,
  b.latitude, b.longitude,
  b.phone, b.website, b.social_links, b.price_range,
  b.published_at, b.is_featured AND coalesce(b.featured_until > now(), true) AS is_featured,
  b.verified_at IS NOT NULL AS is_verified,
  b.updated_at,
  b.timezone
FROM bars b
JOIN users u ON u.id = b.owner_id
WHERE b.publication_status = 'published'
  AND b.deleted_at IS NULL
  AND u.role = 'owner'
  AND u.account_status = 'active';

-- ---------------------------------------------------------------------
-- Datos semilla de catálogos
-- ---------------------------------------------------------------------
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Coctelería', 'cocteleria', 'martini', 1),
  ('Mezcalería', 'mezcaleria', 'flame', 2),
  ('Cervecería', 'cerveceria', 'beer', 3),
  ('Rooftop', 'rooftop', 'building-2', 4),
  ('Vinos', 'wine-bar', 'wine', 5),
  ('Speakeasy', 'speakeasy', 'key-round', 6),
  ('Música en vivo', 'musica-en-vivo', 'music', 7),
  ('Karaoke', 'karaoke', 'mic-vocal', 8),
  ('Deportivo', 'deportivo', 'trophy', 9)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO establishment_types (name, slug, sort_order) VALUES
  ('Bar', 'bar', 1),
  ('Cantina', 'cantina', 2),
  ('Pub', 'pub', 3),
  ('Lounge', 'lounge', 4),
  ('Bar-restaurante', 'bar-restaurante', 5),
  ('Antro / club', 'club', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO amenities (name, slug, icon, sort_order) VALUES
  ('Terraza', 'terraza', 'sun', 1),
  ('Música en vivo', 'musica-en-vivo', 'music', 2),
  ('Wi-Fi', 'wifi', 'wifi', 3),
  ('Pet friendly', 'pet-friendly', 'dog', 4),
  ('Estacionamiento', 'estacionamiento', 'car', 5),
  ('Accesible', 'accesible', 'accessibility', 6),
  ('Acepta tarjeta', 'acepta-tarjeta', 'credit-card', 7),
  ('Reservaciones', 'reservaciones', 'calendar-check', 8),
  ('Comida', 'comida', 'utensils', 9),
  ('Área de fumar', 'area-fumar', 'cigarette', 10)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- Etapa 4: imágenes procesadas y fotos de revisiones
-- Una foto con revision_id pertenece a una revisión en curso de un bar ya
-- publicado: NO es pública hasta que el admin aprueba la revisión.
-- ---------------------------------------------------------------------
ALTER TABLE bar_images ADD COLUMN IF NOT EXISTS thumb_url text;
ALTER TABLE bar_images ADD COLUMN IF NOT EXISTS revision_id uuid REFERENCES bar_revisions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS bar_images_revision_idx ON bar_images (revision_id) WHERE revision_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Etapa 6: reportes, analítica y deduplicación de eventos
-- ---------------------------------------------------------------------
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note text;
CREATE INDEX IF NOT EXISTS reports_bar_idx ON reports (bar_id, status);

-- Evita contar dos veces la misma visita/clic: clave = hash(visitante, bar, tipo, día).
-- No guarda IPs ni datos personales; se purga a los 3 días.
CREATE TABLE IF NOT EXISTS event_dedupe (
  key        text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_dedupe_created_idx ON event_dedupe (created_at);
