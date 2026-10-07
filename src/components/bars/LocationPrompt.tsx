import { LocateFixed, MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui'

export type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'

interface LocationPromptProps {
  state: LocationState
  onRequest: () => void
}

/**
 * Pide la ubicación de forma explícita y nunca bloquea: si el usuario la
 * rechaza, se ofrece buscar por ciudad.
 */
export function LocationPrompt({ state, onRequest }: LocationPromptProps) {
  if (state === 'granted') return null
  const denied = state === 'denied' || state === 'unavailable'
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-ink-50 p-5 sm:flex-row sm:items-center">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-brand-600 shadow-xs">
        {denied ? <MapPinOff className="size-6" /> : <LocateFixed className="size-6" />}
      </span>
      <div className="flex-1">
        <p className="font-semibold text-fg">{state === 'unavailable' ? 'No pudimos obtener tu ubicación' : denied ? 'No tenemos acceso a tu ubicación' : 'Descubre bares cerca de ti'}</p>
        <p className="text-sm text-fg-muted">
          {denied
            ? 'Sin problema: busca por ciudad o colonia. Puedes activarla después desde tu navegador.'
            : 'Usamos tu ubicación solo para ordenar resultados por distancia. No la guardamos.'}
        </p>
      </div>
      {!denied && (
        <Button variant="dark" size="sm" onClick={onRequest} loading={state === 'requesting'}>
          Usar mi ubicación
        </Button>
      )}
    </div>
  )
}
