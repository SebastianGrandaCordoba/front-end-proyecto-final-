import type { Candidate } from '../lib/domain'
import { formatGrade, round1 } from '../lib/domain'
import type { Trend } from '../lib/insights'

/** Student × subject grid. Each cell is the student's average in that subject, coloured by level. */
export default function Heatmap({ trends, subjects, onSelect }: { trends: Trend[]; subjects: string[]; onSelect: (student: Candidate) => void }) {
  const rows = trends.filter(t => t.student.hasGrades)
  const tone = (value: number) => round1(value) < 3 ? 'low' : round1(value) < 4 ? 'medium' : 'high'
  return <div className="heatmap-wrap" role="region" aria-label="Mapa de calor por tema" tabIndex={0}>
    <table className="heatmap">
      <thead><tr><th scope="col">Estudiante</th>{subjects.map(subject => <th key={subject} scope="col">{subject}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.student.id}>
        <th scope="row"><button className="link-btn" onClick={() => onSelect(row.student)}>{row.student.name}</button></th>
        {subjects.map(subject => {
          const cell = row.bySubject.find(s => s.name === subject)
          return <td key={subject} className={cell ? `heat heat-${tone(cell.average)}` : 'heat heat-none'} title={cell ? `${row.student.name} · ${subject}: ${formatGrade(cell.average)}` : 'Sin notas'}>{cell ? formatGrade(cell.average) : '—'}</td>
        })}
      </tr>)}</tbody>
    </table>
  </div>
}
