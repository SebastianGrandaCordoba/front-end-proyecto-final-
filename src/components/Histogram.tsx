import { formatGrade, gradeScale } from '../lib/domain'
import type { GradeBand } from '../lib/insights'

/** Students per one-point band of their average. Bars below 3,0 use the reinforcement colour. */
export default function Histogram({ bands }: { bands: GradeBand[] }) {
  const max = Math.max(1, ...bands.map(b => b.students))
  const total = bands.reduce((s, b) => s + b.students, 0)
  return <figure className="histogram" aria-label={`Distribución de promedios: ${bands.map(b => `${b.label}: ${b.students}`).join(', ')}`}>
    <div className="histogram-bars">
      {bands.map((band, index) => <div key={band.label} className="histogram-col" style={{ '--i': index } as React.CSSProperties}>
        <span className="num">{band.students || ''}</span>
        <i className={band.to <= 3 ? 'bar-low' : band.to <= 4 ? 'bar-medium' : 'bar-high'} style={{ height: `${band.students / max * 100}%` }} />
        <small>{gradeScale() === 5 ? band.label : `${formatGrade(band.from)}–${formatGrade(band.to)}`}</small>
      </div>)}
    </div>
    <figcaption>{total} estudiantes con notas, por promedio · en rojo, por debajo de {formatGrade(3)}</figcaption>
  </figure>
}
