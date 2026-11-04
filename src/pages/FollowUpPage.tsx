import { Download, FileText, MessageSquareText, Sparkles } from 'lucide-react'
import type { PageProps } from '../App'
import { ImportButton } from '../app/actions'
import { Avatar, EmptyState, useFeedback } from '../components/ui'
import Heatmap from '../components/Heatmap'
import { API_BASE, TOKEN_KEY } from '../api'
import { downloadBlob, downloadLearningReport, slugify } from '../lib/files'
import { formatGrade, plural, type Candidate } from '../lib/domain'
import { Simulator } from './followup/Simulator'

type View = 'prioridad' | 'tendencia' | 'mapa' | 'simulador'
type Group = { id: string; title: string; rule: string; tone: string; students: Candidate[]; reason: (student: Candidate) => string }

export default function FollowUpPage({ workspace, review, startWorkshop, assistant, params, navigate }: PageProps & { params: URLSearchParams }) {
  const { course, candidates, summary, insights } = workspace
  const view = (['prioridad', 'tendencia', 'mapa', 'simulador'].includes(params.get('vista') ?? '') ? params.get('vista') : 'prioridad') as View
  const weakest = insights[0]
  const { notify } = useFeedback()
  // The backend writes the report (with trend, risk and projection); fall back to the local CSV if it is unavailable.
  const downloadServerCsv = async () => {
    if (!course) return
    try {
      const response = await fetch(`${API_BASE}/api/courses/${course.id}/insights/report.csv`, { headers: { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) ?? ''}` } })
      if (!response.ok) throw new Error(String(response.status))
      downloadBlob(`seguimiento-${slugify(course.name)}.csv`, await response.blob())
    } catch {
      downloadLearningReport(candidates, course.name)
      notify('Descargué la versión básica del reporte; el servidor no respondió.', 'info')
    }
  }

  return <section className="page">
    <header className="page-head">
      <div><h1>Seguimiento</h1><p>{summary.gradeCount ? `${course?.name}: ${plural(summary.low, 'estudiante necesita', 'estudiantes necesitan')} refuerzo y ${workspace.trends.filter(t => t.direction === 'down').length} ${workspace.trends.filter(t => t.direction === 'down').length === 1 ? 'viene' : 'vienen'} bajando.` : `Carga las notas de ${course?.name} para ver quién necesita apoyo.`}</p></div>
      <div className="page-actions">
        <button className="btn btn-secondary" onClick={assistant.report} disabled={!summary.gradeCount}><FileText size={16} aria-hidden />Informe PDF</button>
        <button className="btn btn-ghost" onClick={() => void downloadServerCsv()} disabled={!candidates.length}><Download size={16} aria-hidden />CSV</button>
        {summary.low > 0 && <button className="btn btn-primary" onClick={() => startWorkshop({ mode: 'workshop', level: 'LOW', group: summary.low, topic: weakest && weakest.average < 3.5 ? weakest.name : undefined })}><Sparkles size={16} aria-hidden />Refuerzo para el grupo</button>}
      </div>
    </header>

    <div className="tabs tabs-page" role="tablist" aria-label="Vista de seguimiento">
      {([['prioridad', 'Prioridades'], ['tendencia', 'Tendencia'], ['mapa', 'Mapa por tema'], ['simulador', 'Simulador']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'is-on' : ''} onClick={() => navigate('seguimiento', id === 'prioridad' ? undefined : { vista: id })}>{label}</button>)}
    </div>

    {!candidates.length ? <div className="panel"><EmptyState art="read" title="Aún no hay estudiantes" text="Importa la lista y las notas del curso para empezar el seguimiento." action={<ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant="primary" />} /></div>
      : view === 'prioridad' ? <Priorities candidates={candidates} review={review} />
        : view === 'tendencia' ? <Trends workspace={workspace} review={review} message={assistant.message} />
          : view === 'mapa' ? <SubjectMap workspace={workspace} review={review} />
          : <Simulator workspace={workspace} review={review} />}
  </section>
}

function Priorities({ candidates, review }: { candidates: Candidate[]; review: (s: Candidate) => void }) {
  const sorted = [...candidates].sort((a, b) => (a.hasGrades ? a.average : 99) - (b.hasGrades ? b.average : 99))
  const groups: Group[] = [
    { id: 'low', title: 'Necesitan refuerzo', rule: 'Promedio menor a 3,0', tone: 'low', students: sorted.filter(s => s.hasGrades && s.level === 'LOW'), reason: s => `Promedio ${formatGrade(s.average)} en ${plural(s.gradeCount, 'nota', 'notas')}. Conviene repasar los conceptos base.` },
    { id: 'medium', title: 'En seguimiento', rule: 'Promedio de 3,0 a menos de 4,0', tone: 'medium', students: sorted.filter(s => s.hasGrades && s.level === 'MEDIUM'), reason: s => `Promedio ${formatGrade(s.average)}. Un quiz corto te dice si va mejorando.` },
    { id: 'none', title: 'Sin notas', rule: 'No puedo evaluar sin datos', tone: 'none', students: sorted.filter(s => !s.hasGrades), reason: () => 'No hay notas cargadas para este estudiante.' },
    { id: 'high', title: 'Buen progreso', rule: 'Promedio de 4,0 o más', tone: 'high', students: sorted.filter(s => s.hasGrades && s.level === 'HIGH'), reason: s => `Promedio ${formatGrade(s.average)}. Puedes proponerle un reto.` },
  ]
  return <>
    <p className="explainer">Clasifico con el promedio de las notas cargadas, al instante y sin IA. Es una guía: tú decides cómo acompañar a cada estudiante.</p>
    <div className="followup">{groups.filter(group => group.students.length).map(group => <section key={group.id} className={`followup-group tone-${group.tone}`} aria-labelledby={`g-${group.id}`}>
      <header><h2 id={`g-${group.id}`}>{group.title}</h2><span className="count">{group.students.length}</span><small>{group.rule}</small></header>
      <ul>{group.students.map(student => <li key={student.id}><button className="followup-row" onClick={() => review(student)}>
        <Avatar name={student.name} />
        <span className="followup-main"><b>{student.name}</b><small>{group.reason(student)}</small></span>
        <span className="followup-grade num">{student.hasGrades ? formatGrade(student.average) : '—'}</span>
        <span className="person-cta">Ver ficha</span>
      </button></li>)}</ul>
    </section>)}</div>
  </>
}

function SubjectMap({ workspace, review }: { workspace: PageProps['workspace']; review: (s: Candidate) => void }) {
  const subjects = workspace.insights.map(s => s.name)
  if (!subjects.length) return <div className="panel"><EmptyState art="read" title="Aún no hay notas por tema" text="Cuando cargues notas con su materia, verás aquí quién va bien y quién no en cada tema." /></div>
  return <>
    <p className="explainer">Cada celda es el promedio del estudiante en ese tema. Los temas van del más difícil al más fácil, así ves de un vistazo dónde reforzar.</p>
    <Heatmap trends={workspace.trends} subjects={subjects} onSelect={review} />
  </>
}

function Trends({ workspace, review, message }: { workspace: PageProps['workspace']; review: (s: Candidate) => void; message: (s: Candidate) => void }) {
  const { trends, sim } = workspace
  const periods = sim.observed
  if (periods.length < 2) return <div className="panel"><EmptyState title="Necesito dos cortes o más" text={`Por ahora hay notas de ${periods.length ? `un solo periodo (${periods[0]})` : 'ningún periodo'}. Cuando cargues el siguiente corte verás quién sube y quién baja.`} /></div>
  const riskLabel = (risk: number) => risk >= 60 ? 'Alto' : risk >= 35 ? 'Medio' : 'Bajo'
  return <>
    <p className="explainer">El riesgo combina el promedio con la tendencia entre {periods[0]} y {periods[periods.length - 1]}. Una caída de 0,3 o más se marca como “baja”.</p>
    <div className="table-card"><table className="table">
      <caption className="visually-hidden">Promedio de cada estudiante por corte, cambio y riesgo</caption>
      <thead><tr><th scope="col">Estudiante</th>{periods.map(p => <th key={p} scope="col" className="num">{p}</th>)}<th scope="col" className="num">Cambio</th><th scope="col">Riesgo</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
      <tbody>{trends.filter(t => t.student.hasGrades).map(t => <tr key={t.student.id}>
        <td><button className="person-cell" onClick={() => review(t.student)}><Avatar name={t.student.name} /><span><b>{t.student.name}</b><small>{t.weakest ? `Le cuesta ${t.weakest.name}` : ''}</small></span></button></td>
        {periods.map(p => { const point = t.points.find(x => x.period === p); return <td key={p} className="num">{point ? formatGrade(point.average) : <span className="muted">—</span>}</td> })}
        <td className={`num delta-${t.direction}`}>{t.delta == null ? '—' : `${t.delta > 0 ? '+' : t.delta < 0 ? '−' : ''}${formatGrade(Math.abs(t.delta))}`}</td>
        <td><span className="risk"><span className="risk-track"><i className={`risk-${riskLabel(t.risk).toLowerCase()}`} style={{ width: `${t.risk}%` }} /></span>{riskLabel(t.risk)}</span></td>
        <td><div className="row-actions"><button className="icon-btn" onClick={() => message(t.student)} aria-label={`Escribirle a ${t.student.name}`} title="Escribirle"><MessageSquareText size={16} /></button></div></td>
      </tr>)}</tbody>
    </table></div>
  </>
}


