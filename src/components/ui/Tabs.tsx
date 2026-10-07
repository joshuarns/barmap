import { cn } from '@/lib/cn'

interface TabsProps<T extends string> {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Pestañas subrayadas para filtrar listados (p. ej. estados de moderación). */
export function Tabs<T extends string>({ tabs, value, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn('scrollbar-none flex gap-6 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative -mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 text-sm font-semibold transition-colors',
              active ? 'border-ink-900 text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs', active ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600')}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
