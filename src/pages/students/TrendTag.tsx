
export function TrendTag({ direction }: { direction?: 'down' | 'up' | 'flat' | 'unknown' }) {
  if (direction === 'down') return <span className="trend trend-down">↓ Baja</span>
  if (direction === 'up') return <span className="trend trend-up">↑ Sube</span>
  if (direction === 'flat') return <span className="muted">Estable</span>
  return <span className="muted">—</span>
}
