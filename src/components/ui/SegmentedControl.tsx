import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Option<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full bg-ink-100 p-1', className)}>
      {options.map(({ value: v, label: l, icon: Icon }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all duration-200',
              active ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {l}
          </button>
        )
      })}
    </div>
  )
}
