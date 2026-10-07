import { config } from './config.js'
import { pool } from './db/pool.js'
import { createApp } from './app.js'

const server = createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`Barmap API escuchando en :${config.port}`)
})

server.on('error', (err) => {
  console.error('[fatal] No se pudo enlazar el servidor:', err)
  process.exit(1)
})

// Apagado ordenado: cierra conexiones y el pool para que el reinicio sea limpio.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => pool.end().finally(() => process.exit(0)))
    setTimeout(() => process.exit(0), 3000).unref()
  })
}
