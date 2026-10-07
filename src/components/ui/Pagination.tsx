import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}

/** Páginas visibles: primera, última y vecinas de la actual. */
function pages(current: number, total: number): (number | '…')[] {
  const set = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  const btn = 'flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors'
  return (
    <nav aria-label="Paginación" className={cn('flex items-center justify-center gap-1', className)}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior" className={cn(btn, 'hover:bg-ink-50 disabled:opacity-30')}>
        <ChevronLeft className="size-5" />
      </button>
      {pages(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="w-6 text-center text-fg-subtle">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page ? 'bg-ink-900 text-white' : 'hover:bg-ink-50')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Página siguiente" className={cn(btn, 'hover:bg-ink-50 disabled:opacity-30')}>
        <ChevronRight className="size-5" />
      </button>
    </nav>
  )
}
