import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatNumber } from '@/lib/format'

interface Point {
  /** Fecha ISO (YYYY-MM-DD). */
  x: string
  y: number
}

interface AreaChartProps {
  data: Point[]
  /** Nombre de la serie (tooltip y lector de pantalla). */
  label: string
  height?: number
  /** Color de la serie; el texto nunca usa este color. */
  color?: string
  className?: string
}

const dayFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const fullFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
const parse = (iso: string) => new Date(`${iso}T12:00:00`)

/** Máximo "limpio" para el eje: 1, 2, 2.5, 5 × 10^n. */
function niceMax(v: number) {
  if (v <= 0) return 4
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

/**
 * Serie única en el tiempo: línea de 2px + área al 10%, cuadrícula recesiva,
 * punto final con etiqueta directa, y cursor vertical con tooltip (también
 * con teclado: ← →). Sin leyenda: el título de la tarjeta nombra la serie.
 */
export function AreaChart({ data, label, height = 240, color = 'var(--color-brand-600)', className }: AreaChartProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = { top: 16, right: 48, bottom: 28, left: 44 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...data.map((d) => d.y), 0))
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max]

  const pts = useMemo(
    () => data.map((d, i) => ({ ...d, cx: pad.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w), cy: pad.top + h - (d.y / max) * h })),
    [data, w, h, max, pad.left, pad.top],
  )
  if (!pts.length) return null

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].cx.toFixed(1)},${pad.top + h} L${pts[0].cx.toFixed(1)},${pad.top + h} Z`
  const xLabels = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter((v, i, a) => a.indexOf(v) === i)
  const last = pts[pts.length - 1]
  const cur = active !== null ? pts[active] : null

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const i = Math.round((x / rect.width) * (pts.length - 1))
    setActive(Math.min(Math.max(i, 0), pts.length - 1))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min((a ?? -1) + 1, pts.length - 1))
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max((a ?? pts.length) - 1, 0))
    else return
    e.preventDefault()
  }

  return (
    <div ref={wrap} className={className} style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}: ${formatNumber(data.reduce((a, d) => a + d.y, 0))} en total del ${dayFmt.format(parse(data[0].x))} al ${dayFmt.format(parse(last.x))}`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="block outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        {/* Cuadrícula y eje Y (recesivos) */}
        {ticks.map((t) => {
          const y = pad.top + h - (t / max) * h
          return (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={pad.left - 8} y={y} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-fg-subtle)" className="tabular-nums">
                {formatNumber(Math.round(t))}
              </text>
            </g>
          )
        })}
        {xLabels.map((i) => (
          <text key={i} x={pts[i].cx} y={height - 8} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--color-fg-subtle)">
            {dayFmt.format(parse(pts[i].x))}
          </text>
        ))}

        {/* Serie */}
        <path d={area} fill={color} fillOpacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Punto final con etiqueta directa (valor del último día) */}
        {!cur && (
          <>
            <circle cx={last.cx} cy={last.cy} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
            <text x={last.cx + 8} y={last.cy} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-fg)" className="tabular-nums">
              {formatNumber(last.y)}
            </text>
          </>
        )}

        {/* Cursor */}
        {cur && (
          <>
            <line x1={cur.cx} x2={cur.cx} y1={pad.top} y2={pad.top + h} stroke="var(--color-ink-400)" strokeWidth={1} />
            <circle cx={cur.cx} cy={cur.cy} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
          </>
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={w}
          height={h}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          style={{ touchAction: 'pan-y' }}
        />
      </svg>

      {cur && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-md"
          style={{
            top: Math.max(cur.cy - 64, 0),
            left: Math.min(Math.max(cur.cx - 70, 0), width - 150),
            width: 150,
          }}
        >
          <p className="text-base font-bold tabular-nums text-fg">{formatNumber(cur.y)}</p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} aria-hidden /> {label}
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle first-letter:uppercase">{fullFmt.format(parse(cur.x))}</p>
        </div>
      )}
    </div>
  )
}
