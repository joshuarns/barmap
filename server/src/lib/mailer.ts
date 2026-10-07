import { config } from '../config.js'

interface Mail {
  to: string
  subject: string
  /** Párrafos en texto plano; se escapan y se envuelven en la plantilla. */
  paragraphs: string[]
  action?: { label: string; url: string }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function render(mail: Mail) {
  const body = mail.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#35323f">${esc(p)}</p>`).join('')
  const button = mail.action
    ? `<p style="margin:24px 0"><a href="${esc(mail.action.url)}" style="display:inline-block;background:#C93D14;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${esc(mail.action.label)}</a></p>
       <p style="font-size:13px;color:#6b6778">Si el botón no funciona, copia este enlace:<br>${esc(mail.action.url)}</p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f7f6f3;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:22px;font-weight:800;color:#17151f;margin:0 0 24px">barmap</p>
    <div style="background:#fff;border-radius:20px;padding:28px">${body}${button}</div>
    <p style="font-size:12px;color:#8a8697;margin-top:20px">Recibiste este correo porque tienes una cuenta en Barmap.</p>
  </div></body></html>`
}

/**
 * Envía un correo transaccional. Sin RESEND_API_KEY lo imprime en consola
 * (desarrollo). Nunca lanza: un fallo de correo no debe romper el flujo.
 */
export async function sendMail(mail: Mail) {
  const text = [...mail.paragraphs, mail.action ? `${mail.action.label}: ${mail.action.url}` : ''].join('\n\n')
  if (!config.resendApiKey) {
    console.log(`\n📧 [correo simulado] Para: ${mail.to}\n   Asunto: ${mail.subject}\n   ${text.replace(/\n/g, '\n   ')}\n`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, to: mail.to, subject: mail.subject, html: render(mail), text }),
    })
    if (!res.ok) console.error('[mail] Resend respondió', res.status, await res.text())
  } catch (err) {
    console.error('[mail] Error al enviar', err)
  }
}

export const appLink = (path: string) => `${config.appUrl}${path}`
