import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { iconFor } from '@/components/icons/registry'
import { CATEGORY_ICONS } from './categories'

interface CategoryRailProps {
  categories: { slug: string; name: string; icon?: string | null }[]
  value: string
  onChange: (slug: string) => void
  className?: string
}

/** Carril horizontal de categorías con icono, desplazable en móvil. */
export function CategoryRail({ categories, value, onChange, className }: CategoryRailProps) {
  return (
    <div role="tablist" aria-label="Categorías" className={cn('scrollbar-none -mx-4 flex gap-7 overflow-x-auto px-4 md:mx-0 md:gap-9 md:px-0', className)}>
      {categories.map((c) => {
        const Icon = c.icon ? iconFor(c.icon) : (CATEGORY_ICONS[c.slug] ?? Sparkles)
        const active = c.slug === value
        return (
          <button
            key={c.slug}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.slug)}
            className={cn(
              'group flex shrink-0 flex-col items-center gap-2 border-b-2 pb-3 pt-1 transition-colors',
              active ? 'border-ink-900 text-fg' : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <Icon className={cn('size-6 transition-transform duration-200 group-hover:-translate-y-0.5', active && 'text-brand-600')} strokeWidth={1.75} aria-hidden />
            <span className="text-xs font-semibold">{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}
