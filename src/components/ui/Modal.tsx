import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Modal basado en <dialog> nativo: foco atrapado, Escape y backdrop gratis.
 * En móvil se presenta como hoja inferior (bottom sheet).
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className={cn(
        'm-0 mt-auto max-h-[92dvh] w-full max-w-none flex-col rounded-t-3xl bg-surface p-0 text-fg shadow-lg backdrop:bg-ink-900/45 backdrop:backdrop-blur-[2px] open:flex open:animate-fade-up',
        'md:m-auto md:max-w-lg md:rounded-3xl',
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 id="modal-title" className="font-sans text-lg font-bold tracking-normal">
            {title}
          </h2>
          {description && <p className="mt-1 text-[15px] text-fg-muted">{description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-ink-50 hover:text-fg">
          <X className="size-5" />
        </button>
      </div>
      {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-1 pt-5">{children}</div>}
      {footer && <div className="pb-safe flex shrink-0 flex-col-reverse gap-3 border-t border-line px-6 py-5 sm:flex-row sm:justify-end">{footer}</div>}
    </dialog>
  )
}
