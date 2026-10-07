import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,box-shadow,transform,border-color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700',
        dark: 'bg-ink-900 text-white shadow-xs hover:bg-ink-700',
        outline: 'border border-line-strong bg-surface text-fg hover:border-ink-900 hover:bg-ink-50',
        subtle: 'bg-ink-50 text-fg hover:bg-ink-100',
        ghost: 'text-fg hover:bg-ink-50',
        danger: 'bg-danger-600 text-white shadow-xs hover:bg-danger-700',
        link: 'rounded-none px-0 text-brand-600 underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        sm: 'h-9 rounded-lg px-3.5 text-sm [&_svg]:size-4',
        md: 'h-11 rounded-xl px-5 text-[15px] [&_svg]:size-[18px]',
        lg: 'h-13 rounded-xl px-7 text-base [&_svg]:size-5',
        icon: 'size-10 rounded-full [&_svg]:size-[18px]',
        'icon-sm': 'size-8 rounded-full [&_svg]:size-4',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
    </button>
  ),
)
Button.displayName = 'Button'
