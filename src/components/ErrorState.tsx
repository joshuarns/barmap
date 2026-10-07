import { RefreshCw, WifiOff } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Algo salió mal.'
  return (
    <EmptyState
      icon={WifiOff}
      tone="danger"
      title="No pudimos cargar la información"
      description={message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> Reintentar
          </Button>
        )
      }
    />
  )
}
