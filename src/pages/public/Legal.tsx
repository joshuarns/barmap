import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import NotFound from '@/pages/NotFound'

/**
 * PLANTILLAS: describen fielmente cómo funciona Barmap (qué datos se recaban
 * y para qué), pero deben revisarse con un abogado antes del lanzamiento
 * (LFPDPPP en México, razón social, domicilio y contacto del responsable).
 */
const DOCS: Record<string, { title: string; updated: string; sections: [string, string[]][] }> = {
  terminos: {
    title: 'Términos y condiciones',
    updated: '6 de octubre de 2026',
    sections: [
      ['Qué es Barmap', ['Barmap es una plataforma para descubrir bares y para que sus propietarios publiquen información de sus establecimientos. La información de cada bar la proporciona su propietario y es revisada por nuestro equipo antes de publicarse.']],
      ['Cuentas', ['Para guardar favoritos o publicar un establecimiento necesitas una cuenta. Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad de tu cuenta.', 'Podemos suspender cuentas que publiquen información falsa, suplanten a un negocio o hagan un uso abusivo de la plataforma.']],
      ['Propietarios y publicaciones', ['Solo pueden publicar personas autorizadas a representar el establecimiento. Al enviar una publicación declaras que la información es veraz y que tienes derecho a usar las fotografías.', 'Toda publicación y todo cambio pasa por revisión. Podemos aprobar, pedir cambios, rechazar o retirar temporalmente una publicación, indicando el motivo.']],
      ['Contenido prohibido', ['Información falsa o engañosa, contenido ofensivo o ilegal, fotografías de terceros sin permiso y promoción de actividades ilícitas.']],
      ['Consumo responsable', ['Barmap está dirigido a personas mayores de edad. Promovemos el consumo responsable de alcohol.']],
      ['Limitación de responsabilidad', ['Los horarios, precios y servicios los publica cada establecimiento y pueden cambiar. Te recomendamos confirmarlos antes de tu visita. Si encuentras un error, repórtalo desde la página del bar.']],
    ],
  },
  privacidad: {
    title: 'Aviso de privacidad',
    updated: '6 de octubre de 2026',
    sections: [
      ['Datos que recabamos', ['Cuenta: nombre, correo electrónico y contraseña (guardada de forma cifrada e irreversible).', 'Propietarios: nombre del negocio, teléfono de contacto, ciudad, sitio web y redes que nos compartas para verificar la solicitud.', 'Ubicación: solo si la activas, para ordenar resultados por distancia. Se usa en tu navegador y en la búsqueda; no la guardamos.', 'Estadísticas: contamos visitas, clics en "Cómo llegar" y compartidos de forma agregada por día. No guardamos tu dirección IP: usamos un identificador anónimo que se borra a los 3 días.']],
      ['Finalidades', ['Operar tu cuenta, mostrar y moderar publicaciones, enviarte correos sobre tu cuenta y tus solicitudes, prevenir abusos y mostrar estadísticas agregadas a los propietarios.']],
      ['Fotografías', ['Eliminamos los metadatos de las fotos que suben los propietarios, incluida la ubicación GPS, antes de publicarlas.']],
      ['Cookies', ['Usamos una sola cookie esencial para mantener tu sesión iniciada. No usamos cookies de publicidad ni de rastreo de terceros.']],
      ['Con quién compartimos datos', ['Con proveedores que nos ayudan a operar el servicio (alojamiento, envío de correos, mapas) y solo para esas finalidades. No vendemos tus datos.']],
      ['Tus derechos', ['Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos (derechos ARCO) escribiéndonos al correo de contacto indicado en el Centro de ayuda.']],
    ],
  },
}

export default function Legal() {
  const { doc = '' } = useParams()
  const d = DOCS[doc]
  useDocumentMeta({ title: d?.title ?? 'Información legal' })
  if (!d) return <NotFound />
  return (
    <article className="container-page max-w-3xl py-10 md:py-16">
      <h1 className="text-[36px] font-extrabold md:text-[44px]">{d.title}</h1>
      <p className="mt-2 text-fg-muted">Última actualización: {d.updated}</p>
      {import.meta.env.DEV && (
        <Alert tone="warning" className="mt-6" title="Plantilla pendiente de revisión legal">
          Este texto describe el funcionamiento real de Barmap, pero debe revisarlo un abogado antes del lanzamiento.
        </Alert>
      )}
      {d.sections.map(([title, paras]) => (
        <section key={title} className="mt-8">
          <h2 className="text-[22px] font-bold">{title}</h2>
          {paras.map((p) => <p key={p.slice(0, 30)} className="mt-3 text-[16px] leading-relaxed text-ink-700">{p}</p>)}
        </section>
      ))}
      <p className="mt-10 text-sm text-fg-muted">
        Consulta también {doc === 'terminos' ? <Link to="/legal/privacidad" className="underline">el aviso de privacidad</Link> : <Link to="/legal/terminos" className="underline">los términos y condiciones</Link>}.
      </p>
    </article>
  )
}
