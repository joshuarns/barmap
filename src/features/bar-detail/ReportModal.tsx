import { useState } from 'react'
import { Honeypot } from '@/components/auth/fields'
import { Alert, Button, Field, Modal, Textarea, useToast } from '@/components/ui'
import { REPORT_REASONS, useReportBar, type ReportReason } from '@/features/engagement'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'

/** Reporte anónimo o con sesión. El servidor limita la frecuencia y evita duplicados. */
export function ReportModal({ open, onClose, slug, name }: { open: boolean; onClose: () => void; slug: string; name: string }) {
  const report = useReportBar(slug)
  const toast = useToast()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [hp, setHp] = useState('')
  const [touched, setTouched] = useState(false)
  const detailsError = touched && reason === 'other' && details.trim().length < 10 ? 'Cuéntanos qué ocurre (mínimo 10 caracteres)' : undefined

  const close = () => {
    onClose()
    setTimeout(() => { setReason(null); setDetails(''); setTouched(false); report.reset() }, 200)
  }
  const send = () => {
    setTouched(true)
    if (!reason || detailsError || (reason === 'other' && details.trim().length < 10)) return
    report.mutate(
      { reason, details: details.trim(), website_url: hp },
      {
        onSuccess: () => {
          close()
          toast({ tone: 'success', title: 'Gracias por avisarnos', description: 'Nuestro equipo revisará la información.' })
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Reportar un problema"
      description={`¿Qué ocurre con «${name}»? Tu reporte es anónimo para el establecimiento.`}
      footer={<><Button variant="outline" onClick={close}>Cancelar</Button><Button variant="dark" onClick={send} loading={report.isPending}>Enviar reporte</Button></>}
    >
      <div className="relative space-y-4">
        {report.isError && <Alert tone={report.error instanceof ApiError && report.error.status === 409 ? 'info' : 'danger'} title={report.error.message} />}
        <fieldset>
          <legend className="sr-only">Motivo</legend>
          <div className="space-y-2">
            {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
              <label key={r} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-[15px] transition-colors', reason === r ? 'border-ink-900 bg-ink-50' : 'border-line-strong hover:border-ink-400')}>
                <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-ink-900" />
                {REPORT_REASONS[r]}
              </label>
            ))}
          </div>
          {touched && !reason && <p className="mt-2 text-[13px] font-medium text-danger-600">Elige un motivo</p>}
        </fieldset>
        <Field label="Detalles" optional={reason !== 'other'} error={detailsError}>
          <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Ej. El horario cambió: ahora abren a las 19:00." />
        </Field>
        <Honeypot value={hp} onChange={setHp} />
      </div>
    </Modal>
  )
}
