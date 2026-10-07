import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  hint?: string
  tone?: 'neutral' | 'brand' | 'warning' | 'success' | 'info'
}

const toneClass = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-600',
  warning: 'bg-warning-50 text-warning-700',
  success: 'bg-success-50 text-success-700',
  info: 'bg-info-50 text-info-600',
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-snug text-fg-muted">{label}</p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', toneClass[tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-[32px] font-bold leading-none tracking-tight text-fg tabular-nums">{formatNumber(value)}</p>
      {hint && <p className="mt-2 text-sm text-fg-muted">{hint}</p>}
    </div>
  )
}
