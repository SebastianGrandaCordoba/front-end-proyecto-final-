import { Download, Sparkles } from 'lucide-react'
import type { PageProps } from '../App'
import { ImportButton } from '../app/actions'
import { Avatar, EmptyState } from '../components/ui'
import { downloadLearningReport } from '../lib/files'
import { formatGrade, plural, type Candidate } from '../lib/domain'

type Group = { id: string; title: string; rule: string; tone: string; students: Candidate[]; reason: (student: Candidate) => string }

export default function FollowUpPage({ workspace, review, startWorkshop }: PageProps) {
  const { course, candidates, summary, insights } = workspace
  const sorted = [...candidates].sort((a, b) => (a.hasGrades ? a.average : 99) - (b.hasGrades ? b.average : 99))
  const weakest = insights[0]
  const groups: Group[] = [
    { id: 'low', title: 'Necesitan refuerzo', rule: 'Promedio menor a 3,0', tone: 'low', students: sorted.filter(s => s.hasGrades && s.level === 'LOW'), reason: s => `Promedio ${formatGrade(s.average)} en ${plural(s.gradeCount, 'nota', 'notas')}. Conviene repasar los conceptos base.` },
    { id: 'medium', title: 'En seguimiento', rule: 'Promedio de 3,0 a menos de 4,0', tone: 'medium', students: sorted.filter(s => s.hasGrades && s.level === 'MEDIUM'), reason: s => `Promedio ${formatGrade(s.average)}. Un quiz corto te dice si va mejorando.` },
    { id: 'none', title: 'Sin notas', rule: 'No puedo evaluar sin datos', tone: 'none', students: sorted.filter(s => !s.hasGrades), reason: () => 'No hay notas cargadas para este estudiante.' },
    { id: 'high', title: 'Buen progreso', rule: 'Promedio de 4,0 o más', tone: 'high', students: sorted.filter(s => s.hasGrades && s.level === 'HIGH'), reason: s => `Promedio ${formatGrade(s.average)}. Puedes proponerle un reto.` },
  ]

  return <section className="page">
    <header className="page-head">
      <div><h1>Seguimiento</h1><p>{summary.gradeCount ? `${course?.name}: ${plural(summary.low, 'estudiante necesita', 'estudiantes necesitan')} refuerzo y ${summary.medium} ${summary.medium === 1 ? 'está' : 'están'} en seguimiento.` : `Carga las notas de ${course?.name} para ver quién necesita apoyo.`}</p></div>
      <div className="page-actions">
        <button className="btn btn-secondary" onClick={() => downloadLearningReport(sorted, course?.name ?? 'curso')} disabled={!candidates.length}><Download size={16} aria-hidden />Descargar reporte</button>
        {summary.low > 0 && <button className="btn btn-primary" onClick={() => startWorkshop({ mode: 'workshop', level: 'LOW', group: summary.low, topic: weakest && weakest.average < 3.5 ? weakest.name : undefined })}><Sparkles size={16} aria-hidden />Refuerzo para el grupo</button>}
      </div>
    </header>

    <p className="explainer">Clasifico con el promedio de las notas cargadas; no uso la IA para esto, así que es inmediato. Es una guía: tú decides cómo acompañar a cada estudiante.</p>

    {!candidates.length ? <div className="panel"><EmptyState title="Aún no hay estudiantes" text="Importa la lista y las notas del curso para empezar el seguimiento." action={<ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant="primary" />} /></div>
      : <div className="followup">
        {groups.filter(group => group.students.length).map(group => <section key={group.id} className={`followup-group tone-${group.tone}`} aria-labelledby={`g-${group.id}`}>
          <header><h2 id={`g-${group.id}`}>{group.title}</h2><span className="count">{group.students.length}</span><small>{group.rule}</small></header>
          <ul>{group.students.map(student => <li key={student.id}>
            <button className="followup-row" onClick={() => review(student)}>
              <Avatar name={student.name} />
              <span className="followup-main"><b>{student.name}</b><small>{group.reason(student)}</small></span>
              <span className="followup-grade num">{student.hasGrades ? formatGrade(student.average) : '—'}</span>
              <span className="person-cta">Ver recomendación</span>
            </button>
          </li>)}</ul>
        </section>)}
      </div>}
  </section>
}
