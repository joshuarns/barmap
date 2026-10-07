import { useState, type FormEvent } from 'react'
import { LocateFixed, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SearchQuery {
  q: string
  where: string
}

interface HeroSearchProps {
  onSearch: (query: SearchQuery) => void
  onUseLocation?: () => void
  defaultValue?: Partial<SearchQuery>
  className?: string
}

/**
 * Buscador protagonista. Escritorio: píldora de dos segmentos ("Qué" / "Dónde").
 * Móvil: tarjeta apilada con campos grandes, fácil de usar con el pulgar.
 */
export function HeroSearch({ onSearch, onUseLocation, defaultValue, className }: HeroSearchProps) {
  const [q, setQ] = useState(defaultValue?.q ?? '')
  const [where, setWhere] = useState(defaultValue?.where ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch({ q: q.trim(), where: where.trim() })
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        'w-full rounded-3xl border border-line bg-surface p-2 shadow-search md:flex md:items-center md:rounded-full md:p-2 md:pl-3',
        className,
      )}
    >
      <label className="flex flex-1 cursor-text items-center gap-3 rounded-2xl px-4 py-3 transition-colors focus-within:bg-ink-50 hover:bg-ink-50 md:rounded-full md:py-2.5">
        <Search className="size-5 shrink-0 text-fg-muted" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-bold text-fg">Qué buscas</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Bar, coctelería, mezcal…"
            className="w-full bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </span>
      </label>

      <span className="mx-4 block h-px bg-line md:mx-0 md:h-8 md:w-px" aria-hidden />

      <label className="flex flex-1 cursor-text items-center gap-3 rounded-2xl px-4 py-3 transition-colors focus-within:bg-ink-50 hover:bg-ink-50 md:rounded-full md:py-2.5">
        <MapPin className="size-5 shrink-0 text-fg-muted" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-bold text-fg">Dónde</span>
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="Ciudad o colonia"
            className="w-full bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </span>
        {onUseLocation && (
          <button
            type="button"
            onClick={onUseLocation}
            title="Usar mi ubicación"
            aria-label="Usar mi ubicación"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-50"
          >
            <LocateFixed className="size-5" />
          </button>
        )}
      </label>

      <button
        type="submit"
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-semibold text-white shadow-xs transition-[background-color,transform] hover:bg-brand-700 active:scale-[0.98] md:ml-2 md:mt-0 md:size-14 md:shrink-0 md:rounded-full md:px-0"
      >
        <Search className="size-5" strokeWidth={2.5} aria-hidden />
        <span className="md:sr-only">Buscar</span>
      </button>
    </form>
  )
}
