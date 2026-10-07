import { cn } from '@/lib/cn'

/** Isotipo: un pin de mapa cuya silueta interior es una copa de cóctel. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <path
        fill="currentColor"
        d="M16 1.5C9.1 1.5 3.5 7 3.5 13.8c0 8.7 10.4 16.1 11.6 16.9.5.4 1.3.4 1.8 0 1.2-.8 11.6-8.2 11.6-16.9C28.5 7 22.9 1.5 16 1.5Z"
      />
      <path
        fill="#fff"
        d="M9.6 8.6h12.8c.6 0 .9.7.5 1.1l-5.6 6.1v4.6h2.3a.9.9 0 0 1 0 1.8h-7.2a.9.9 0 0 1 0-1.8h2.3v-4.6L9.1 9.7c-.4-.4-.1-1.1.5-1.1Z"
      />
      <circle cx="19.6" cy="11" r="1.3" fill="currentColor" />
    </svg>
  )
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <LogoMark className={inverted ? 'text-brand-400' : 'text-brand-600'} />
      <span className={cn('font-display text-[23px] font-extrabold tracking-[-0.04em]', inverted ? 'text-white' : 'text-ink-900')}>
        barmap
      </span>
    </span>
  )
}
