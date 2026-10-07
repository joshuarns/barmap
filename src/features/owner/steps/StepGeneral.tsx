import { Field, Input, Select, Textarea } from '@/components/ui'
import { iconFor } from '@/components/icons/registry'
import { cn } from '@/lib/cn'
import type { StepProps } from './types'

export function StepGeneral({ form, set, errors, catalog }: StepProps) {
  const descLen = form.description.trim().length
  return (
    <div className="space-y-6">
      <Field label="Nombre del bar" error={errors.name} hint="Tal como aparece en tu fachada o redes.">
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} autoComplete="organization" />
      </Field>

      <Field
        label="Descripción"
        error={errors.description}
        hint="Qué lo hace especial: ambiente, especialidad, música, para qué tipo de plan es ideal."
        aside={<span className={cn('text-xs tabular-nums', descLen < 40 ? 'text-fg-subtle' : 'text-success-700')}>{descLen}/1200</span>}
      >
        <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1200} rows={6} />
      </Field>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-fg">Categoría principal</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {catalog.categories.map((c) => {
            const Icon = iconFor(c.icon)
            const active = form.categoryId === c.id
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => set('categoryId', c.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left text-[15px] font-medium transition-colors',
                  active ? 'border-ink-900 bg-ink-50 ring-1 ring-ink-900' : 'border-line-strong hover:border-ink-400',
                )}
              >
                <Icon className={cn('size-5 shrink-0', active ? 'text-brand-600' : 'text-fg-muted')} aria-hidden />
                {c.name}
              </button>
            )
          })}
        </div>
        {errors.categoryId && <p className="mt-2 text-[13px] font-medium text-danger-600">{errors.categoryId}</p>}
      </fieldset>

      <Field label="Tipo de establecimiento" error={errors.typeId}>
        <Select value={form.typeId ?? ''} onChange={(e) => set('typeId', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Selecciona un tipo</option>
          {catalog.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
    </div>
  )
}
