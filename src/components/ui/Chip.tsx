import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/** Chip conmutador para filtros (servicios, precio, "abierto ahora"...). */
export function Chip({ selected, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-10 max-w-full shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150 [&_svg]:size-4',
        selected
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-line-strong bg-surface text-fg hover:border-ink-900',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
