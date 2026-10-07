import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, ...props }, ref) => (
    <label className={cn('group flex cursor-pointer items-start gap-3', props.disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input ref={ref} type="checkbox" className="peer absolute inset-0 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface transition-colors checked:border-ink-900 checked:bg-ink-900 hover:border-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" {...props} />
        <Check className="pointer-events-none relative m-auto size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-medium text-fg">{label}</span>
        {description && <span className="text-sm text-fg-muted">{description}</span>}
      </span>
    </label>
  ),
)
Checkbox.displayName = 'Checkbox'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ label, className, ...props }, ref) => (
  <label className={cn('inline-flex cursor-pointer items-center gap-3', className)}>
    <span className="relative inline-flex h-6 w-10 shrink-0">
      <input ref={ref} type="checkbox" role="switch" className="peer absolute inset-0 cursor-pointer appearance-none rounded-full bg-ink-200 transition-colors checked:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" {...props} />
      <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-4" />
    </span>
    <span className="text-[15px] font-medium text-fg">{label}</span>
  </label>
))
Switch.displayName = 'Switch'
