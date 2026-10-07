import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Grid2x2, X } from 'lucide-react'
import type { BarDetail } from '@/types/api'
import { LogoMark } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

/**
 * Galería: mosaico 1+4 en escritorio, carrusel deslizable en móvil y visor
 * a pantalla completa con todas las fotos.
 */
export function Gallery({ images, name }: { images: BarDetail['images']; name: string }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const viewer = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = viewer.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  if (!images.length) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-3xl bg-ink-100 text-ink-300 md:aspect-[21/8]">
        <LogoMark className="size-16" />
      </div>
    )
  }

  const alt = (i: number) => `${name}, foto ${i + 1} de ${images.length}`

  return (
    <>
      {/* Móvil */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={track}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="scrollbar-none flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setOpen(true)} className="h-full w-full shrink-0 snap-center">
              <img src={img.url} alt={alt(i)} className="h-full w-full object-cover" loading={i ? 'lazy' : 'eager'} />
            </button>
          ))}
        </div>
        <span className="absolute bottom-3 right-3 rounded-md bg-ink-900/70 px-2 py-1 text-xs font-semibold text-white">
          {index + 1} / {images.length}
        </span>
      </div>

      {/* Escritorio: mosaico que se adapta a 1–5 fotos sin huecos */}
      <div className={cn('relative hidden h-[420px] gap-2 overflow-hidden rounded-3xl md:grid lg:h-[480px]', mosaicGrid(images.length))}>
        {images.slice(0, 5).map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setOpen(true)}
            className={cn('group relative overflow-hidden bg-ink-100', mosaicCell(images.length, i))}
          >
            <img src={img.url} alt={alt(i)} className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-90" loading={i ? 'lazy' : 'eager'} />
          </button>
        ))}
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute bottom-5 right-5 inline-flex h-9 items-center gap-2 rounded-lg border border-ink-900 bg-surface px-3.5 text-sm font-semibold shadow-sm hover:bg-ink-50"
          >
            <Grid2x2 className="size-4" /> Ver las {images.length} fotos
          </button>
        )}
      </div>

      <dialog ref={viewer} onClose={() => setOpen(false)} aria-label={`Fotos de ${name}`} className="m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 backdrop:bg-ink-900/60">
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:px-8">
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar galería" className="flex size-10 items-center justify-center rounded-full hover:bg-ink-50">
            <ChevronLeft className="size-5 md:hidden" />
            <X className="hidden size-5 md:block" />
          </button>
          <p className="font-semibold">{name}</p>
          <span className="w-10" />
        </div>
        <div className="mx-auto grid max-w-4xl gap-2 p-2 md:grid-cols-2 md:gap-3 md:p-8">
          {images.map((img, i) => (
            <img key={img.url} src={img.url} alt={alt(i)} loading="lazy" className={cn('w-full rounded-xl object-cover', i % 3 === 0 && 'md:col-span-2')} />
          ))}
        </div>
      </dialog>
    </>
  )
}

function mosaicGrid(n: number) {
  if (n === 1) return 'grid-cols-1'
  if (n === 2) return 'grid-cols-2'
  return 'grid-cols-4 grid-rows-2'
}

function mosaicCell(n: number, i: number) {
  if (n <= 2) return ''
  if (i === 0) return 'col-span-2 row-span-2'
  if (n === 3) return 'col-span-2'
  if (n === 4 && i === 1) return 'col-span-2'
  return ''
}
