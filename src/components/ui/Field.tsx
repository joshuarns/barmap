import { useId, type ReactElement, type ReactNode, cloneElement } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FieldProps {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  /** Un único control (Input, Textarea, Select). Recibe id y aria-* automáticamente. */
  children: ReactElement<Record<string, unknown>>
  aside?: ReactNode
}

export function Field({ label, hint, error, optional, className, children, aside }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
          {optional && <span className="ml-1 font-normal text-fg-subtle">(opcional)</span>}
        </label>
        {aside}
      </div>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-[13px] font-medium text-danger-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
