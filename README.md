# Barmap

Plataforma para descubrir bares y gestionar establecimientos con moderación manual.

Arquitectura y decisiones: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Desarrollo

```bash
npm install
npm --prefix server install

# Frontend (http://localhost:5173) — guía del sistema de diseño en /design
npm run dev

# API (http://localhost:4000)
createdb barmap
cp server/.env.example server/.env
npm run migrate
npm run seed        # bares y cuentas de demostración (solo desarrollo)
npm run dev:server

# Crear un administrador real (única vía para obtener el rol admin)
npm run create-admin -- --email tu@correo.com --name "Tu Nombre"
```

Vite reenvía `/api` al puerto 4000 en desarrollo.

**Cuentas demo** (tras `npm run seed`, contraseña `barmap-demo-1`): `admin@demo.barmap.local`, `owner@demo.barmap.local`, `solicitante@demo.barmap.local` (solicitud pendiente).

**Correos en desarrollo**: sin `RESEND_API_KEY` se imprimen en la consola del servidor, con el enlace de verificación o recuperación.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Frontend con Vite |
| `npm run dev:server` | API con recarga (tsx watch) |
| `npm run migrate` | Aplica `server/src/db/schema.sql` (idempotente) |
| `npm run seed` | Carga bares de demostración (solo desarrollo, idempotente) |
| `npm run create-admin -- --email … --name …` | Crea o promueve un administrador |
| `npm run typecheck` | Comprueba tipos del cliente y del servidor |
| `npm run build` | Build de producción del cliente |
