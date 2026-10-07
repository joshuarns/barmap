import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface StepperProps {
  steps: string[]
  current: number
  onStepClick?: (index: number) => void
  /** Último paso al que se puede saltar (por defecto, el actual). */
  maxStep?: number
  className?: string
}

/**
 * Indicador de progreso para formularios por pasos.
 * En móvil muestra "Paso 2 de 5" + barra; en escritorio, los pasos con nombre.
 */
export function Stepper({ steps, current, onStepClick, maxStep, className }: StepperProps) {
  const progress = ((current + 1) / steps.length) * 100
  return (
    <nav aria-label="Progreso" className={className}>
      <div className="md:hidden">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-fg">{steps[current]}</span>
          <span className="text-fg-muted">
            Paso {current + 1} de {steps.length}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="hidden items-center md:flex">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          const clickable = onStepClick && i <= (maxStep ?? current) && i !== current
          return (
            <li key={label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(i)}
                aria-current={active ? 'step' : undefined}
                className="group flex items-center gap-2.5 disabled:cursor-default"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                    done && 'bg-ink-900 text-white',
                    active && 'bg-brand-600 text-white ring-4 ring-brand-100',
                    !done && !active && 'border border-line-strong bg-surface text-fg-muted',
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('text-sm font-semibold', active || done ? 'text-fg' : 'text-fg-muted', clickable && !active && 'group-hover:underline')}>
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={cn('mx-4 h-px flex-1', done ? 'bg-ink-900' : 'bg-line-strong')} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
