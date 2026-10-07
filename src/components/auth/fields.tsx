import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui'

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="flex size-9 items-center justify-center rounded-full hover:bg-ink-50 hover:text-fg"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      }
      {...props}
    />
  )
})
PasswordInput.displayName = 'PasswordInput'

/** Requisitos visibles mientras se escribe la contraseña. */
export function PasswordHints({ value }: { value: string }) {
  const rules = [
    { ok: value.length >= 8, label: '8 caracteres o más' },
    { ok: /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value), label: 'Letras y números' },
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
      {rules.map((r) => (
        <li key={r.label} className={r.ok ? 'font-medium text-success-700' : 'text-fg-muted'}>
          {r.ok ? '✓' : '○'} {r.label}
        </li>
      ))}
    </ul>
  )
}

export const passwordValid = (v: string) => v.length >= 8 && v.length <= 72 && /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v)

/**
 * Campo trampa antispam: invisible y fuera del orden de tabulación.
 * Un bot que rellena todos los campos lo completa y el servidor lo descarta.
 */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Sitio web
        <input type="text" name="website_url" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
