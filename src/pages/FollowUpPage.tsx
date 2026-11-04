import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, MessageSquareText, Sparkles } from 'lucide-react'
import type { PageProps } from '../App'
import { ImportButton } from '../app/actions'
import { Avatar, EmptyState, useFeedback } from '../components/ui'
import Heatmap from '../components/Heatmap'
import { API_BASE, TOKEN_KEY } from '../api'
import { downloadBlob, downloadLearningReport, slugify } from '../lib/files'
import { formatGrade, plural, type Candidate } from '../lib/domain'
import type { Projection } from '../lib/insights'

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

const statusLabel: Record<Projection['status'], string> = { passed: 'Asegurado', possible: 'Alcanzable', hard: 'Exigente', impossible: 'No alcanza', 'no-data': 'Sin notas' }
const statusTone: Record<Projection['status'], string> = { passed: 'high', possible: 'high', hard: 'medium', impossible: 'low', 'no-data': 'none' }

function Simulator({ workspace, review }: { workspace: PageProps['workspace']; review: (s: Candidate) => void }) {
  const { sim, saveScheme, projections } = workspace
  const { notify } = useFeedback()
  const [whatIf, setWhatIf] = useState(3)
  const [onlyRisk, setOnlyRisk] = useState(false)
  const [draft, setDraft] = useState<number[]>(sim.weights)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(sim.weights) }, [sim.weights.join(',')])
  const sum = draft.reduce((s, w) => s + w, 0)
  const periods = [...sim.observed, ...Array.from({ length: Math.max(0, draft.length - sim.observed.length) }, (_, i) => `Corte ${sim.observed.length + i + 1}`)]
  // The backend stores the scheme and recalculates every projection; save once the weights add up to 100.
  useEffect(() => {
    if (sum !== 100 || draft.join(',') === sim.weights.join(',')) return
    const timer = window.setTimeout(() => {
      setSaving(true)
      saveScheme(draft).catch(error => notify(error instanceof Error ? error.message : 'No se pudo guardar el esquema.', 'error')).finally(() => setSaving(false))
    }, 600)
    return () => window.clearTimeout(timer)
  }, [draft.join(','), sum])
  const rows = useMemo(() => [...projections.values()]
    .filter(p => !onlyRisk || p.status === 'hard' || p.status === 'impossible')
    .sort((a, b) => (b.needed ?? -1) - (a.needed ?? -1)), [projections, onlyRisk])
  const setTotal = (total: number) => setDraft(total === 3 ? [30, 30, 40] : total === 2 ? [50, 50] : [25, 25, 25, 25])
  const setWeight = (index: number, value: number) => setDraft(current => current.map((w, i) => i === index ? value : w))
  const finalWith = (p: Projection) => p.earned + whatIf * p.remainingWeight
  const counts = { hard: [...projections.values()].filter(p => p.status === 'hard').length, impossible: [...projections.values()].filter(p => p.status === 'impossible').length }

  return <>
    <div className="sim-config panel">
      <div className="sim-block"><span className="field-label">Esquemas comunes</span>
        <div className="presets">{[[30, 30, 40], [20, 30, 50], [33, 33, 34], [50, 50]].map(preset => <button key={preset.join('-')} type="button" className={`chip${draft.join(',') === preset.join(',') ? ' is-on' : ''}`} disabled={preset.length < sim.observed.length} onClick={() => setDraft(preset)}>{preset.join(' / ')}</button>)}</div>
      </div>
      <div className="sim-block"><span className="field-label">Cortes del semestre</span>
        <div className="size-picker" role="radiogroup" aria-label="Número de cortes">{[2, 3, 4].map(n => <button key={n} type="button" role="radio" aria-checked={draft.length === n} className={draft.length === n ? 'is-on' : ''} disabled={n < sim.observed.length} onClick={() => setTotal(n)}>{n}</button>)}</div>
      </div>
      <div className="sim-block"><span className="field-label">Peso de cada corte {sum !== 100 ? <span className="is-low">· suman {sum}%, deben sumar 100%</span> : saving ? <span className="muted">· guardando…</span> : sim.custom ? <span className="muted">· guardado en el curso</span> : null}</span>
        <div className="weights">{periods.map((period, i) => <label key={period} className="weight"><small>{period}{i >= sim.observed.length ? ' (falta)' : ''}</small><span><input type="number" min={0} max={100} value={draft[i] ?? 0} onChange={event => setWeight(i, Math.max(0, Math.min(100, Number(event.target.value) || 0)))} inputMode="numeric" />%</span></label>)}</div>
      </div>
      <div className="sim-block"><label className="field-label" htmlFor="whatif">¿Y si todos sacan <b className="num">{formatGrade(whatIf)}</b> en lo que falta?</label>
        <input id="whatif" type="range" min={0} max={5} step={0.1} value={whatIf} onChange={event => setWhatIf(Number(event.target.value))} className="range" />
      </div>
    </div>
    <p className="explainer">{[counts.impossible ? `${plural(counts.impossible, 'estudiante ya no alcanza', 'estudiantes ya no alcanzan')} el 3,0.` : '', counts.hard ? `${plural(counts.hard, 'estudiante necesita', 'estudiantes necesitan')} más de 3,5 en lo que falta.` : '', !counts.impossible && !counts.hard ? 'Con las notas actuales, todos pueden aprobar sin necesitar más de 3,5 en lo que falta.' : ''].filter(Boolean).join(' ')} Para aprobar se necesita 3,0.</p>
    <label className="toggle"><input type="checkbox" checked={onlyRisk} onChange={event => setOnlyRisk(event.target.checked)} /> Ver solo estudiantes en riesgo</label>
    <div className="table-card"><table className="table">
      <caption className="visually-hidden">Nota necesaria para aprobar y nota final simulada de cada estudiante</caption>
      <thead><tr><th scope="col">Estudiante</th><th scope="col" className="num">Va en</th><th scope="col" className="num">Necesita</th><th scope="col">Estado</th><th scope="col" className="num">Final si saca {formatGrade(whatIf)}</th></tr></thead>
      <tbody>{rows.map(p => { const final = finalWith(p); return <tr key={p.student.id}>
        <td><button className="person-cell" onClick={() => review(p.student)}><Avatar name={p.student.name} /><span><b>{p.student.name}</b><small>{p.explanation}</small></span></button></td>
        <td className="num">{p.status === 'no-data' ? '—' : formatGrade(p.current)}</td>
        <td className="num"><b className={p.status === 'impossible' || p.status === 'hard' ? 'is-low' : ''}>{p.needed == null ? '—' : formatGrade(p.needed)}</b></td>
        <td><span className={`pill pill-${statusTone[p.status]}`}>{statusLabel[p.status]}</span></td>
        <td className={`num${Math.round(final * 10) < 30 ? ' is-low' : ''}`}>{p.status === 'no-data' ? '—' : <>{formatGrade(final)}{Math.round(final * 10) >= 30 && p.status !== 'passed' && <span className="whatif-pass" title="Con esa nota aprobaría"> ✓</span>}</>}</td>
      </tr> })}</tbody>
    </table>{!rows.length && <EmptyState art="celebrate" title="Nadie en riesgo" text="Con las notas actuales todos pueden aprobar cómodamente." />}</div>
  </>
}
