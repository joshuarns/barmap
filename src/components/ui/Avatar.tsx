import { cn } from '@/lib/cn'

const palette = ['bg-brand-100 text-brand-800', 'bg-info-50 text-info-700', 'bg-success-50 text-success-700', 'bg-warning-50 text-warning-700', 'bg-ink-100 text-ink-700']

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  const color = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length]
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }
  return src ? (
    <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover', sizes[size], className)} />
  ) : (
    <span aria-label={name} className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', sizes[size], color, className)}>
      {initials}
    </span>
  )
}
