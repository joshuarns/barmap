import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/ErrorState'
import { ICON_NAMES, iconFor } from '@/components/icons/registry'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Skeleton, Switch, Tabs, useToast } from '@/components/ui'
import { useCatalogAdmin, useCatalogMutations, type CatalogKind, type CatalogRow } from '@/features/admin/platform'
import { ApiError } from '@/lib/api'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'

const KINDS: { value: CatalogKind; label: string; singular: string; hasIcon: boolean }[] = [
  { value: 'categories', label: 'Categorías', singular: 'categoría', hasIcon: true },
  { value: 'types', label: 'Tipos de establecimiento', singular: 'tipo', hasIcon: false },
  { value: 'amenities', label: 'Servicios', singular: 'servicio', hasIcon: true },
]

export default function Catalogs() {
  const [kind, setKind] = useState<CatalogKind>('categories')
  const meta = KINDS.find((k) => k.value === kind)!
  const list = useCatalogAdmin(kind)
  const m = useCatalogMutations(kind)
  const toast = useToast()
  const [editing, setEditing] = useState<CatalogRow | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<CatalogRow | null>(null)
  useDocumentMeta({ title: 'Catálogos' })

  const fail = (e: Error) => toast({ tone: 'error', title: 'No se pudo guardar', description: e.message })
  const items = list.data ?? []
  const move = (i: number, dir: -1 | 1) => {
    const a = items[i]
    const b = items[i + dir]
    if (!a || !b) return
    // Intercambia posiciones (dos actualizaciones; el orden final se recarga).
    m.update.mutate({ id: a.id, sortOrder: b.sortOrder === a.sortOrder ? b.sortOrder + dir : b.sortOrder }, {
      onSuccess: () => m.update.mutate({ id: b.id, sortOrder: a.sortOrder }, { onError: fail }),
      onError: fail,
    })
  }

  return (
    <>
      <PageHeader
        title="Categorías y servicios"
        description="Lo que los propietarios pueden elegir y el público usa para filtrar. Desactivar oculta una opción sin afectar a los bares que ya la usan."
        actions={<Button onClick={() => setEditing('new')}><Plus /> Agregar {meta.singular}</Button>}
      />
      <Tabs className="mb-5" value={kind} onChange={setKind} tabs={KINDS.map((k) => ({ value: k.value, label: k.label }))} />

      {list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => list.refetch()} /></Card>
      ) : !list.data ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : items.length === 0 ? (
        <Card><EmptyState icon={Tags} title="Sin elementos" action={<Button onClick={() => setEditing('new')}><Plus /> Agregar</Button>} /></Card>
      ) : (
        <Card className="divide-y divide-line">
          {items.map((it, i) => {
            const Icon = meta.hasIcon ? iconFor(it.icon) : null
            return (
              <div key={it.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-5', !it.isActive && 'bg-subtle')}>
                <div className="flex flex-col">
                  <button type="button" aria-label="Subir" disabled={i === 0 || m.update.isPending} onClick={() => move(i, -1)} className="rounded p-0.5 text-fg-muted hover:text-fg disabled:opacity-30"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label="Bajar" disabled={i === items.length - 1 || m.update.isPending} onClick={() => move(i, 1)} className="rounded p-0.5 text-fg-muted hover:text-fg disabled:opacity-30"><ArrowDown className="size-4" /></button>
                </div>
                {Icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>}
                <div className="min-w-0 flex-1">
                  <p className={cn('font-semibold', !it.isActive && 'text-fg-muted')}>{it.name}</p>
                  <p className="text-sm text-fg-subtle">{it.slug} · usado por {it.usage} {it.usage === 1 ? 'bar' : 'bares'}</p>
                </div>
                {!it.isActive && <Badge>Inactivo</Badge>}
                <Switch
                  aria-label={`${it.isActive ? 'Desactivar' : 'Activar'} ${it.name}`}
                  label=""
                  checked={it.isActive}
                  onChange={(e) => m.update.mutate({ id: it.id, isActive: e.target.checked }, { onError: fail })}
                />
                <Button variant="ghost" size="icon" aria-label={`Editar ${it.name}`} onClick={() => setEditing(it)}><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label={`Eliminar ${it.name}`} disabled={it.usage > 0} title={it.usage > 0 ? 'En uso: desactívalo en su lugar' : undefined} onClick={() => setToDelete(it)}><Trash2 /></Button>
              </div>
            )
          })}
        </Card>
      )}

      {editing && (
        <EditModal
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          hasIcon={meta.hasIcon}
          singular={meta.singular}
          onClose={() => setEditing(null)}
          saving={m.create.isPending || m.update.isPending}
          onSave={(v, onError) => {
            const opts = { onSuccess: () => { setEditing(null); toast({ tone: 'success', title: 'Guardado' }) }, onError }
            if (editing === 'new') m.create.mutate(v, opts)
            else m.update.mutate({ id: editing.id, ...v }, opts)
          }}
        />
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`¿Eliminar «${toDelete?.name}»?`}
        description="No está en uso por ningún establecimiento. Esta acción no se puede deshacer."
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="danger" loading={m.remove.isPending} onClick={() => m.remove.mutate(toDelete!.id, { onSuccess: () => { setToDelete(null); toast({ tone: 'success', title: 'Eliminado' }) }, onError: fail })}>Eliminar</Button>
          </>
        }
      />
    </>
  )
}

function EditModal({ item, hasIcon, singular, onClose, onSave, saving }: {
  item: CatalogRow | null
  hasIcon: boolean
  singular: string
  onClose: () => void
  onSave: (v: { name: string; icon?: string | null }, onError: (e: Error) => void) => void
  saving: boolean
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [icon, setIcon] = useState<string | null>(item?.icon ?? (hasIcon ? 'sparkles' : null))
  const [error, setError] = useState<string>()
  const submit = () => {
    if (name.trim().length < 2) return setError('Escribe al menos 2 caracteres')
    onSave({ name: name.trim(), ...(hasIcon ? { icon } : {}) }, (e) => setError(e instanceof ApiError && e.details?.name ? e.details.name[0] === 'Ya existe' ? 'Ya existe un elemento con ese nombre' : e.details.name[0] : e.message))
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `Editar ${singular}` : `Nueva ${singular}`}
      description={item ? 'El identificador (slug) no cambia, para no romper enlaces ni filtros guardados.' : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} loading={saving}>Guardar</Button></>}
    >
      <div className="space-y-5">
        <Field label="Nombre" error={error}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(undefined) }} maxLength={60} autoFocus />
        </Field>
        {hasIcon && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Icono</legend>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {ICON_NAMES.map((n) => {
                const I = iconFor(n)
                return (
                  <button key={n} type="button" aria-label={n} aria-pressed={icon === n} onClick={() => setIcon(n)}
                    className={cn('flex aspect-square items-center justify-center rounded-xl border transition-colors', icon === n ? 'border-ink-900 bg-ink-900 text-white' : 'border-line-strong hover:border-ink-900')}>
                    <I className="size-5" />
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}
      </div>
    </Modal>
  )
}
