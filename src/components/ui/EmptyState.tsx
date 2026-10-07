import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  tone?: 'default' | 'danger'
}

export function EmptyState({ icon: Icon, title, description, action, className, tone = 'default' }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span
        className={cn(
          'mb-5 flex size-14 items-center justify-center rounded-2xl',
          tone === 'danger' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-600',
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="font-sans text-lg font-bold tracking-normal text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[15px] text-fg-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}
