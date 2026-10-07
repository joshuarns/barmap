import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export const controlBase =
  'w-full rounded-xl border border-line-strong bg-surface text-[15px] text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 hover:border-ink-400 focus:border-ink-900 focus:outline-none focus:ring-4 focus:ring-ink-900/8 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-fg-subtle aria-invalid:border-danger-600 aria-invalid:focus:ring-danger-600/12'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leading, trailing, ...props }, ref) => {
    if (!leading && !trailing) {
      return <input ref={ref} className={cn(controlBase, 'h-12 px-4', className)} {...props} />
    }
    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-fg-muted [&_svg]:size-[18px]">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          className={cn(controlBase, 'h-12 px-4', leading && 'pl-11', trailing && 'pr-11', className)}
          {...props}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-fg-muted [&_svg]:size-[18px]">
            {trailing}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(controlBase, 'resize-y px-4 py-3 leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, 'h-12 appearance-none pl-4 pr-11', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
    </div>
  ),
)
Select.displayName = 'Select'
