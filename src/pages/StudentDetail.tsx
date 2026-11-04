import { ListChecks, Sparkles } from 'lucide-react'
import type { Grade } from '../api'
import type { SupportMode } from '../app/types'
import { Avatar, LevelPill, Modal } from '../components/ui'
import { formatGrade, plural, studentAdvice, type Candidate, type Subject } from '../lib/domain'

export default function StudentDetail({ student, grades, subjects, onClose, onStart }: { student: Candidate; grades: Grade[]; subjects: Subject[]; onClose: () => void; onStart: (mode: SupportMode) => void }) {
  const names = new Map(subjects.map(subject => [Number(subject.id), subject.name]))
  return <Modal title={student.name} description={student.email || undefined} onClose={onClose}>
    <div className="student-detail">
      <div className="student-summary">
        <Avatar name={student.name} size={44} />
        <div><b className="num">{student.hasGrades ? formatGrade(student.average) : '—'}</b><small>{student.hasGrades ? `promedio en ${plural(student.gradeCount, 'nota', 'notas')}` : 'sin notas cargadas'}</small></div>
        <LevelPill level={student.level} hasGrades={student.hasGrades} />
      </div>
      <div className="advice"><h3>Mi recomendación</h3><p>{studentAdvice(student)}</p></div>
      {grades.length > 0 && <div className="grade-list"><h3>Notas</h3><table>
        <thead><tr><th scope="col">Tema</th><th scope="col">Periodo</th><th scope="col" className="num">Nota</th></tr></thead>
        <tbody>{grades.slice(-8).reverse().map((grade, index) => { const mark = Number(grade.grade); return <tr key={grade.id ?? index}>
          <td>{names.get(Number(grade.subjectId)) ?? '—'}</td><td>{grade.period || '—'}</td><td className={`num${mark < 3 ? ' is-low' : ''}`}>{Number.isFinite(mark) ? formatGrade(mark) : '—'}</td>
        </tr> })}</tbody>
      </table></div>}
      <p className="privacy-note">Al generar, la IA recibe el material y el nivel; nunca el nombre ni las notas del estudiante.</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => onStart('quiz')}><ListChecks size={16} aria-hidden />Quiz de 3 preguntas</button>
        <button className="btn btn-primary" onClick={() => onStart('workshop')}><Sparkles size={16} aria-hidden />Taller de apoyo</button>
      </div>
    </div>
  </Modal>
}
