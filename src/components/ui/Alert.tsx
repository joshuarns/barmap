import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

const tones = {
  info: { icon: Info, box: 'border-info-600/20 bg-info-50', icon_: 'text-info-600' },
  success: { icon: CheckCircle2, box: 'border-success-600/20 bg-success-50', icon_: 'text-success-600' },
  warning: { icon: AlertTriangle, box: 'border-warning-500/30 bg-warning-50', icon_: 'text-warning-700' },
  danger: { icon: XCircle, box: 'border-danger-600/20 bg-danger-50', icon_: 'text-danger-600' },
}

interface AlertProps {
  tone?: keyof typeof tones
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const t = tones[tone]
  const Icon = t.icon
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-2xl border p-4', t.box, className)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', t.icon_)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-fg">{title}</p>
        {children && <div className="mt-0.5 text-sm text-ink-600">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}
