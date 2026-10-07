import type { PriceRange as PriceRangeValue } from '@/types/domain'
import { cn } from '@/lib/cn'

const LABELS: Record<PriceRangeValue, string> = {
  1: 'Económico',
  2: 'Precio moderado',
  3: 'Precio alto',
  4: 'Premium',
}

export function PriceRange({ value, className }: { value: PriceRangeValue; className?: string }) {
  return (
    <span className={cn('font-semibold tracking-wider', className)} aria-label={LABELS[value]} title={LABELS[value]}>
      <span className="text-fg">{'$'.repeat(value)}</span>
      <span className="text-ink-300" aria-hidden>
        {'$'.repeat(4 - value)}
      </span>
    </span>
  )
}

export { LABELS as PRICE_RANGE_LABELS }
