import { ListChecks, MessageSquareText, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import type { Grade } from '../api'
import type { SupportMode } from '../app/types'
import { Avatar, LevelPill, Modal } from '../components/ui'
import { formatGrade, gradeTone, plural, studentAdvice, type Candidate, type Subject } from '../lib/domain'
import type { Projection, Trend } from '../lib/insights'

export default function StudentDetail({ student, trend, projection, grades, subjects, courseAverage, onClose, onStart, onMessage }: { student: Candidate; trend: Trend | null; projection: Projection | null; grades: Grade[]; subjects: Subject[]; courseAverage?: number | null; onClose: () => void; onStart: (mode: SupportMode) => void; onMessage: () => void }) {
  const names = new Map(subjects.map(subject => [Number(subject.id), subject.name]))
  const tone = gradeTone
  return <Modal title={student.name} description={student.email || undefined} onClose={onClose} size="large">
    <div className="student-detail">
      <div className="student-summary">
        <Avatar name={student.name} size={44} />
        <div><b className="num">{student.hasGrades ? formatGrade(student.average) : '—'}</b><small>{student.hasGrades ? `promedio en ${plural(student.gradeCount, 'nota', 'notas')}${courseAverage != null ? ` · curso ${formatGrade(courseAverage)}` : ''}` : 'sin notas cargadas'}</small></div>
        {trend?.direction === 'down' && <span className="trend trend-down"><TrendingDown size={15} aria-hidden />Viene bajando</span>}
        {trend?.direction === 'up' && <span className="trend trend-up"><TrendingUp size={15} aria-hidden />Viene mejorando</span>}
        <LevelPill level={student.level} hasGrades={student.hasGrades} />
      </div>

      {student.hasGrades && <div className="detail-grid">
        {trend && trend.points.length > 0 && <section className="detail-card">
          <h3>Por corte</h3>
          <div className="columns" role="img" aria-label={trend.points.map(p => `${p.period}: ${formatGrade(p.average)}`).join(', ')}>
            {trend.points.map(point => <div key={point.period} className="column"><span className="num">{formatGrade(point.average)}</span><i className={`bar-${tone(point.average)}`} style={{ height: `${Math.max(6, point.average / 5 * 100)}%` }} /><small>{point.period}</small></div>)}
          </div>
          {projection && <p className={`projection projection-${projection.status}`}>{projection.explanation}</p>}
        </section>}
        {trend && trend.bySubject.length > 0 && <section className="detail-card">
          <h3>Por tema</h3>
          <ul className="hbars">{trend.bySubject.map(item => <li key={item.name}><span>{item.name}</span><span className="hbar"><i className={`bar-${tone(item.average)}`} style={{ width: `${item.average / 5 * 100}%` }} /></span><b className="num">{formatGrade(item.average)}</b></li>)}</ul>
        </section>}
      </div>}

      <div className="advice"><h3>Mi recomendación</h3><p>{studentAdvice(student)}{trend?.weakest && student.level !== 'HIGH' ? ` Empieza por ${trend.weakest.name}.` : ''}</p></div>
      {grades.length > 0 && <details className="grade-list"><summary>Ver las {grades.length} notas</summary><table>
        <thead><tr><th scope="col">Tema</th><th scope="col">Periodo</th><th scope="col" className="num">Nota</th></tr></thead>
        <tbody>{grades.map((grade, index) => { const mark = Number(grade.grade); return <tr key={grade.id ?? index}>
          <td>{names.get(Number(grade.subjectId)) ?? '—'}</td><td>{grade.period || '—'}</td><td className={`num${mark < 3 ? ' is-low' : ''}`}>{Number.isFinite(mark) ? formatGrade(mark) : '—'}</td>
        </tr> })}</tbody>
      </table></details>}
      <p className="privacy-note">Al generar, la IA recibe el material y el nivel; nunca el nombre ni las notas del estudiante.</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onMessage}><MessageSquareText size={16} aria-hidden />Escribirle</button>
        <button className="btn btn-secondary" onClick={() => onStart('quiz')}><ListChecks size={16} aria-hidden />Quiz de 3 preguntas</button>
        <button className="btn btn-primary" onClick={() => onStart('workshop')}><Sparkles size={16} aria-hidden />Taller de apoyo</button>
      </div>
    </div>
  </Modal>
}
