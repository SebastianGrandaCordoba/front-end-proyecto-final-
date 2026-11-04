import { Download, FileText, Sparkles } from 'lucide-react'
import type { PageProps } from '../App'
import { ImportButton } from '../app/actions'
import { EmptyState, useFeedback } from '../components/ui'
import { API_BASE, TOKEN_KEY } from '../api'
import { downloadBlob, downloadLearningReport, slugify } from '../lib/files'
import { plural } from '../lib/domain'
import { Simulator } from './followup/Simulator'
import { Trends } from './followup/Trends'
import { SubjectMap } from './followup/SubjectMap'
import { Priorities } from './followup/Priorities'

type View = 'prioridad' | 'tendencia' | 'mapa' | 'simulador'

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

