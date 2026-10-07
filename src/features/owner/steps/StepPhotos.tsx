import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, Upload } from 'lucide-react'
import { Alert, Badge, Button, Modal, Spinner, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MAX_IMAGE_MB, MAX_IMAGES, MIN_IMAGES, useDeleteImage, useReorderImages, useUploadImage, type WorkingImage } from '../bars'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

interface UploadItem {
  key: string
  name: string
  progress: number
  error?: string
}

/**
 * Gestión de fotos. Las subidas, el orden y el borrado se guardan al
 * instante en el servidor (no dependen del botón "Guardar borrador").
 * La primera foto es la portada.
 */
export function StepPhotos({ barId, images, error, disabled }: { barId: string; images: WorkingImage[]; error?: string; disabled?: boolean }) {
  const upload = useUploadImage(barId)
  const reorder = useReorderImages(barId)
  const remove = useDeleteImage(barId)
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WorkingImage | null>(null)
  const slots = MAX_IMAGES - images.length - queue.filter((q) => !q.error).length

  const addFiles = async (files: File[]) => {
    const accepted: File[] = []
    const rejected: UploadItem[] = []
    for (const f of files) {
      const key = `${f.name}-${f.size}-${Math.random()}`
      if (!f.type.startsWith('image/')) rejected.push({ key, name: f.name, progress: 0, error: 'No es una imagen' })
      else if (f.size > MAX_IMAGE_MB * 1024 * 1024) rejected.push({ key, name: f.name, progress: 0, error: `Supera ${MAX_IMAGE_MB} MB` })
      else if (accepted.length >= slots) rejected.push({ key, name: f.name, progress: 0, error: `Máximo ${MAX_IMAGES} fotos` })
      else accepted.push(f)
    }
    const items = accepted.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, name: f.name, progress: 0 }))
    setQueue((q) => [...q, ...rejected, ...items])
    // Secuencial: menos carga para conexiones móviles y orden predecible.
    for (const [i, file] of accepted.entries()) {
      const key = items[i].key
      try {
        await upload.mutateAsync({ file, onProgress: (p) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, progress: p } : x))) })
        setQueue((q) => q.filter((x) => x.key !== key))
      } catch (e) {
        setQueue((q) => q.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)))
      }
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return
    const ids = images.map((i) => i.id)
    const [m] = ids.splice(from, 1)
    ids.splice(to, 0, m)
    reorder.mutate(ids, { onError: (e) => toast({ tone: 'error', title: 'No se pudo reordenar', description: e.message }) })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files])
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-subtle p-4 text-sm text-fg-muted">
        <p><strong className="text-fg">Consejos:</strong> fotos horizontales, con buena luz, del interior, la barra, la fachada y tus bebidas. La <strong className="text-fg">primera foto es la portada</strong>.</p>
        <p className="mt-1">JPG, PNG, WebP o HEIC · máx. {MAX_IMAGE_MB} MB · mínimo 1000×600 px · entre {MIN_IMAGES} y {MAX_IMAGES} fotos. Eliminamos los datos de ubicación de cada foto.</p>
      </div>

      {error && <Alert tone="danger" title={error} />}

      {!disabled && slots > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn('rounded-2xl border-2 border-dashed transition-colors', dragOver ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-surface hover:border-ink-900')}
        >
          <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-subtle"><Upload className="size-5" /></span>
            <span className="mt-3 font-semibold">Arrastra tus fotos o toca para elegir</span>
            <span className="mt-1 text-sm text-fg-muted">Puedes agregar {slots} más</span>
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </div>
      )}

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((q) => (
            <li key={q.key} className={cn('flex items-center gap-3 rounded-xl border p-3 text-sm', q.error ? 'border-danger-600/30 bg-danger-50' : 'border-line')}>
              {q.error ? <ImagePlus className="size-4 text-danger-600" /> : <Spinner />}
              <span className="min-w-0 flex-1 truncate">{q.name}</span>
              {q.error ? (
                <>
                  <span className="font-medium text-danger-700">{q.error}</span>
                  <button type="button" className="font-semibold underline" onClick={() => setQueue((x) => x.filter((i) => i.key !== q.key))}>Quitar</button>
                </>
              ) : (
                <span className="tabular-nums text-fg-muted">{q.progress < 100 ? `${q.progress}%` : 'Procesando…'}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 ? (
        <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', reorder.isPending && 'opacity-70')}>
          {images.map((img, i) => (
            <li
              key={img.id}
              draggable={!disabled}
              onDragStart={() => setDragId(img.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (dragId) move(images.findIndex((x) => x.id === dragId), i)
                setDragId(null)
              }}
              className={cn('group relative overflow-hidden rounded-2xl bg-ink-100', i === 0 && 'col-span-2 sm:col-span-1 sm:row-span-1', dragId === img.id && 'opacity-40')}
            >
              <img src={img.thumbUrl} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {i === 0 && <Badge tone="overlay" className="absolute left-2 top-2"><Star className="fill-current" /> Portada</Badge>}
              {!disabled && (
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <IconBtn label="Mover a la izquierda" disabled={i === 0} onClick={() => move(i, i - 1)}><ChevronLeft /></IconBtn>
                    <IconBtn label="Mover a la derecha" disabled={i === images.length - 1} onClick={() => move(i, i + 1)}><ChevronRight /></IconBtn>
                  </div>
                  <div className="flex gap-1">
                    {i > 0 && <IconBtn label="Usar como portada" onClick={() => move(i, 0)}><Star /></IconBtn>}
                    <IconBtn label="Eliminar foto" onClick={() => setConfirmDelete(img)}><Trash2 /></IconBtn>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !queue.length && <p className="text-center text-sm text-fg-muted">Aún no hay fotos.</p>
      )}

      <p className="text-sm text-fg-muted">{images.length} de {MAX_IMAGES} fotos{images.length < MIN_IMAGES && ` · faltan ${MIN_IMAGES - images.length} para poder enviar`}</p>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="¿Eliminar esta foto?"
        description="Esta acción no se puede deshacer."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(confirmDelete!.id, {
                  onSuccess: () => setConfirmDelete(null),
                  onError: (e) => toast({ tone: 'error', title: 'No se pudo eliminar', description: e.message }),
                })
              }
            >
              Eliminar
            </Button>
          </>
        }
      >
        {confirmDelete && <img src={confirmDelete.thumbUrl} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />}
      </Modal>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full bg-white/95 text-ink-900 shadow-sm transition hover:scale-105 disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  )
}
