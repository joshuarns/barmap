import { Link } from 'react-router-dom'
import { ChevronDown, Mail } from 'lucide-react'
import { env } from '@/config/env'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

interface QA { q: string; a: string }

const VISITORS: QA[] = [
  { q: '¿Cómo encuentro bares cerca de mí?', a: 'Usa el buscador de la página de inicio o entra a Explorar. Si activas tu ubicación, ordenamos los resultados por distancia y puedes filtrar por kilómetros. Si prefieres no compartirla, busca por ciudad o colonia.' },
  { q: '¿Qué significa "Abierto ahora"?', a: 'Calculamos si el bar está abierto según el horario que publicó el propietario y la hora local del lugar, incluidos los horarios que pasan de la medianoche. Te recomendamos confirmar en días festivos.' },
  { q: '¿Cómo guardo un bar en favoritos?', a: 'Toca el corazón en la tarjeta o en la página del bar. Necesitas una cuenta gratuita para que tus favoritos estén disponibles en cualquier dispositivo.' },
  { q: 'Encontré información incorrecta o un bar que ya cerró', a: 'En la página del bar, toca "Reportar un problema". Nuestro equipo revisa cada reporte; puedes enviarlo sin iniciar sesión.' },
  { q: '¿Qué significa la insignia "Verificado"?', a: 'Nuestro equipo confirmó que el establecimiento existe y que quien lo administra en Barmap está autorizado para hacerlo.' },
]

const OWNERS: QA[] = [
  { q: '¿Cómo publico mi bar?', a: 'Crea una cuenta, confirma tu correo y envía la solicitud de propietario en "Registra tu bar". Cuando la aprobemos (normalmente en 24–48 h hábiles) podrás registrar tus establecimientos en 5 pasos y enviarlos a revisión.' },
  { q: '¿Qué necesito para enviar un establecimiento?', a: 'Nombre, una descripción de al menos 40 caracteres, categoría y tipo, dirección completa con la ubicación marcada en el mapa, horario de al menos un día, rango de precios, un medio de contacto y de 3 a 12 fotos.' },
  { q: '¿Qué fotos son las mejores?', a: 'Horizontales, con buena luz y que muestren el lugar: fachada, barra, salón y bebidas. JPG, PNG, WebP o HEIC de hasta 8 MB y mínimo 1000×600 px. La primera foto es la portada. Eliminamos los datos de ubicación de cada imagen.' },
  { q: '¿Puedo editar un bar ya publicado?', a: 'Sí. Tus cambios se guardan como una nueva versión y la página actual sigue visible hasta que la aprobemos. Mientras está en revisión no puedes modificarla; si cambias de opinión antes de enviarla, puedes descartar los cambios.' },
  { q: 'Me pidieron cambios o rechazaron mi publicación', a: 'Verás el comentario del equipo en tu panel y te llegará por correo. Corrige lo indicado y vuelve a enviarlo desde el último paso del formulario.' },
  { q: '¿Qué pasa si mi publicación o cuenta es suspendida?', a: 'Dejará de mostrarse al público. Puedes seguir consultando tu información, pero no hacer cambios. Te enviaremos el motivo por correo; responde a ese mensaje si crees que es un error.' },
  { q: '¿Cómo se cuentan las visitas?', a: 'Contamos una visita por persona y día en la página de cada bar, además de los clics en "Cómo llegar", las veces que se comparte y cuántas personas lo guardan. Lo ves en Estadísticas.' },
]

function Section({ title, items }: { title: string; items: QA[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-[24px] font-bold">{title}</h2>
      <div className="divide-y divide-line rounded-2xl border border-line">
        {items.map((it) => (
          <details key={it.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold">
              {it.q}
              <ChevronDown className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="pb-5 text-[15px] leading-relaxed text-ink-600">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/** Centro de ayuda. `embedded` lo muestra dentro del panel (sin contenedor de página). */
export default function Help({ embedded, ownersFirst }: { embedded?: boolean; ownersFirst?: boolean }) {
  useDocumentMeta({ title: 'Centro de ayuda', description: 'Preguntas frecuentes sobre cómo usar Barmap y cómo publicar tu bar.' })
  const sections = [<Section key="v" title="Para quienes buscan bares" items={VISITORS} />, <Section key="o" title="Para propietarios" items={OWNERS} />]
  return (
    <div className={embedded ? 'max-w-3xl' : 'container-page max-w-3xl py-10 md:py-16'}>
      {!embedded && <h1 className="text-[36px] font-extrabold md:text-[48px]">Centro de ayuda</h1>}
      <p className="mt-2 text-lg text-fg-muted">Respuestas rápidas a las dudas más comunes.</p>
      {ownersFirst ? sections.reverse() : sections}
      <section className="mt-10 rounded-2xl bg-subtle p-6">
        <h2 className="font-sans text-base font-bold tracking-normal">¿No encontraste lo que buscabas?</h2>
        {env.supportEmail ? (
          <a href={`mailto:${env.supportEmail}`} className="mt-2 inline-flex items-center gap-2 font-semibold hover:underline"><Mail className="size-4" /> {env.supportEmail}</a>
        ) : (
          <p className="mt-2 text-[15px] text-fg-muted">Para problemas con un bar, usa "Reportar un problema" en su página. Para tu cuenta, revisa <Link to="/cuenta" className="underline">Mi cuenta</Link>.</p>
        )}
      </section>
    </div>
  )
}
