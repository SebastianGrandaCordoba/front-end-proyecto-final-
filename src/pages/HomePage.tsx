import type { KeyboardEvent, ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Check, FileText, MessageCircle, Play, TrendingDown, Users, FolderOpen, AlertCircle } from 'lucide-react'
import type { TeacherProfile } from '../api'
import type { PageProps } from '../App'
import FairTeamMark from '../FairTeamMark'
import Owl from '../components/Owl'
import Histogram from '../components/Histogram'
import { ImportButton, MaterialUploadButton } from '../app/actions'
import { headline, recommendations, setupSteps, type Recommendation } from '../lib/assistant'
import { teacherFirstName, fileSize, formatGrade, formatScaled, toCourseScale, greetingFor, levelRule, plural, relativeDate, todayLabel } from '../lib/domain'
import { Avatar, EmptyState } from '../components/ui'
import { DemoButton } from '../components/DemoButton'
import { useCountUp } from '../lib/motion'

export default function HomePage({ workspace, navigate, startWorkshop, review, assistant, user }: PageProps & { user: TeacherProfile }) {
  const { course, courses, candidates, summary, insights, materials, workshops, courseState, coursesState } = workspace
  const weakest = insights[0] ?? null
  const input = { course, courses, candidates, summary, materials, workshops, weakest }
  const loading = coursesState === 'loading' || courseState === 'loading'
  const recs = loading ? [] : recommendations(input)
  const steps = setupSteps(input)
  const stepsDone = steps.filter(step => step.done).length
  const needSupport = candidates.filter(student => student.hasGrades && student.level === 'LOW').sort((a, b) => a.average - b.average)

  const runAction = (rec: Recommendation) => {
    switch (rec.action.kind) {
      case 'create-course': return navigate('courses', courses.length ? {} : { new: '1' })
      case 'support-group': return startWorkshop({ mode: 'workshop', level: 'LOW', group: summary.low, topic: weakest && weakest.average < 3.5 ? weakest.name : undefined })
      case 'open-followup': return navigate('follow-up')
      case 'open-students-ungraded': return navigate('students', { filter: 'ungraded' })
      case 'open-workshop': return navigate('workshops', { open: rec.action.title })
      case 'open-teams': return navigate('teams')
      default: return undefined
    }
  }

  const actionControl = (rec: Recommendation, primary: boolean) => {
    const variant = primary ? 'primary' : 'secondary'
    if (rec.action.kind === 'import-roster') return <ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant={variant}>{rec.cta}</ImportButton>
    if (rec.action.kind === 'import-grades') return <ImportButton kind="grades" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant={variant}>{rec.cta}</ImportButton>
    if (rec.action.kind === 'upload-material') return <MaterialUploadButton courseId={course?.id ?? null} onUploaded={items => workspace.updateMaterials(list => [...items, ...list])} variant={variant}>{rec.cta}</MaterialUploadButton>
    const button = <button className={`btn btn-${variant}`} onClick={() => runAction(rec)}>{rec.cta}<ArrowRight size={16} aria-hidden /></button>
    // A brand-new account can explore everything with demo courses before creating its own.
    if (rec.action.kind === 'create-course' && !courses.length) return <div className="button-row">{button}<DemoButton onLoaded={workspace.loadCourses} /></div>
    return button
  }

  const [lead, ...rest] = recs

  return <section className="page page-home">
    <header className="hero">
      <span className="hero-mesh" aria-hidden />
      <div className="hero-copy">
        <span className="hero-date">{todayLabel()}{course ? ` · ${course.name}` : ''}</span>
        <h1>{greetingFor()}, {teacherFirstName(user.name)}.</h1>
        <p>{loading ? 'Revisando tu curso…' : headline(input)}</p>
        <div className="greeting-actions">
          <button className="btn btn-primary" onClick={assistant.brief} disabled={loading}><Play size={16} aria-hidden />Escuchar el resumen</button>
          <button className="btn btn-secondary" onClick={assistant.open}><MessageCircle size={16} aria-hidden />Preguntarle al Búho</button>
          {summary.gradeCount > 0 && <button className="btn btn-ghost" onClick={assistant.report}><FileText size={16} aria-hidden />Informe del curso</button>}
        </div>
      </div>
      <Owl pose={!loading && summary.gradeCount > 0 && summary.low === 0 ? 'celebrate' : 'wave'} size={170} className="greeting-owl" />
    </header>

    {course && <>
      <dl className="stats" aria-label={`Resumen de ${course.name}`}>
    <div className="stat stat-avg stat-link" {...linkProps('Ver las notas del curso', () => navigate('students', { view: 'grades' }))}>
      <dt>Promedio del curso</dt>
      <dd><Ring value={summary.average} /></dd>
      <span>{summary.gradeCount ? plural(summary.gradeCount, 'nota cargada', 'notas cargadas') : 'carga las notas'}</span>
      <ArrowUpRight className="stat-go" size={16} aria-hidden />
    </div>
    <Stat onOpen={() => navigate('students')} hint="Ver todos los estudiantes" icon={<Users size={18} />} label="Estudiantes" value={loading ? null : summary.students} note={summary.graded ? `${summary.graded} con notas` : 'sin notas aún'} />
    <Stat onOpen={() => navigate('students', { filter: 'support' })} hint="Ver quién necesita refuerzo" icon={<AlertCircle size={18} />} tone={summary.low ? 'low' : undefined} label="Necesitan refuerzo" value={summary.gradeCount ? summary.low : null} note={levelRule.LOW.toLowerCase()} />
    <Stat onOpen={() => navigate('follow-up', { view: 'trend', filter: 'falling' })} hint="Ver quién viene bajando" icon={<TrendingDown size={18} />} tone={summary.fallingBehind ? 'medium' : undefined} label="Vienen bajando" value={workspace.analysisState === 'ready' ? summary.fallingBehind : null} note="entre el primer y el último corte" />
    <Stat onOpen={() => navigate('workshops', { focus: 'material' })} hint="Ver el material guardado" icon={<FolderOpen size={18} />} label="Material guardado" value={materials == null ? null : materials.length} note={materials?.length ? fileSize(materials.reduce((s, m) => s + m.fileSize, 0)) + ' en total' : 'para crear talleres'} />
  </dl>
    </>}

    <section className={`assistant${course && stepsDone < steps.length ? ' has-setup' : ''}`} aria-labelledby="assistant-title">
      <div className="assistant-side">
        <div className="assistant-id"><FairTeamMark size={40} /><div><h2 id="assistant-title">Lo que te recomiendo</h2><small>Según las notas y el material de {course?.name ?? 'tu curso'}</small></div></div>
        {course && stepsDone < steps.length && <div className="setup">
          <div className="setup-head"><span>Preparar el curso</span><b>{stepsDone} de {steps.length}</b></div>
          <ol className="setup-steps">{steps.map(step => <li key={step.id} className={step.done ? 'is-done' : ''}><span className="setup-dot" aria-hidden>{step.done && <Check size={11} strokeWidth={3} />}</span>{step.label}<span className="visually-hidden">{step.done ? ' (hecho)' : ' (pendiente)'}</span></li>)}</ol>
        </div>}
      </div>
      <div className="assistant-list">
        {loading && <div className="rec-skeleton" aria-label="Cargando recomendaciones"><i /><i /><i /></div>}
        {lead && <article className={`rec rec-lead rec-${lead.tone}`}>
          <span className="rec-tag">{lead.tone === 'urgent' ? 'Prioridad' : lead.tone === 'done' ? 'Al día' : 'Siguiente paso'}</span>
          <h3>{lead.title}</h3>
          {lead.detail && <p>{lead.detail}</p>}
          <div className="rec-actions">{actionControl(lead, true)}</div>
        </article>}
        {rest.length > 0 && <ul className="rec-rows">{rest.map(rec => <li key={rec.id} className={`rec rec-row rec-${rec.tone}`}>
          <span className="rec-mark" aria-hidden />
          <div><h3>{rec.title}</h3>{rec.detail && <p>{rec.detail}</p>}</div>
          {actionControl(rec, false)}
        </li>)}</ul>}
      </div>
    </section>

    {course && <>

      <div className="home-grid">
        <section className="panel panel-wide" aria-labelledby="support-title">
          <header className="panel-head"><h2 id="support-title">Necesitan apoyo</h2>{needSupport.length > 0 && <span className="count">{needSupport.length}</span>}<a className="link" href="#/follow-up">Ver seguimiento</a></header>
          {needSupport.length ? <ul className="people">{needSupport.slice(0, 5).map(student => <li key={student.id}>
            <button className="person" onClick={() => review(student)}>
              <Avatar name={student.name} />
              <span className="person-name"><b title={student.name}>{student.name}</b><small>{plural(student.gradeCount, 'nota', 'notas')}</small><i className="person-bar" aria-hidden><u style={{ width: `${Math.max(6, Math.min(100, student.average / 5 * 100))}%` }} /></i></span>
              <span className="person-grade num">{formatGrade(student.average)}</span>
              <span className="person-cta">Ver recomendación</span>
            </button>
          </li>)}</ul> : <EmptyState title={summary.gradeCount ? `Nadie está por debajo de ${formatGrade(3)}` : 'Aún no hay notas'} text={summary.gradeCount ? 'Cuando alguien baje de 3,0 aparecerá aquí con una recomendación.' : 'Carga las notas y te mostraré aquí quién necesita apoyo.'} />}
        </section>

        <section className="panel" aria-labelledby="levels-title">
          <header className="panel-head"><h2 id="levels-title">Cómo va el grupo</h2></header>
          {summary.graded ? <>
            <Donut low={summary.low} medium={summary.medium} high={summary.high} total={summary.graded} />
            <ul className="legend">
              <li><i className="dot dot-low" />Refuerzo<b className="num">{summary.low}</b></li>
              <li><i className="dot dot-medium" />Seguimiento<b className="num">{summary.medium}</b></li>
              <li><i className="dot dot-high" />Buen progreso<b className="num">{summary.high}</b></li>
              {summary.ungraded > 0 && <li><i className="dot dot-none" />Sin notas<b className="num">{summary.ungraded}</b></li>}
            </ul>
            {workspace.distribution.some(b => b.students > 0) && <div className="subjects"><h3>Distribución de promedios</h3><Histogram bands={workspace.distribution} /></div>}
            {insights.length > 0 && <div className="subjects"><h3>Promedio por tema</h3><ul>{insights.slice(0, 4).map(subject => <li key={subject.id}><span>{subject.name}</span><b className={`num${subject.average < 3 ? ' is-low' : ''}`}>{formatGrade(subject.average)}</b></li>)}</ul></div>}
          </> : <EmptyState title="Sin datos todavía" text="La distribución aparece cuando cargas notas." />}
        </section>

        <section className="panel" aria-labelledby="recent-title">
          <header className="panel-head"><h2 id="recent-title">Talleres recientes</h2>{workshops.length > 0 && <span className="count">{workshops.length}</span>}<a className="link" href="#/workshops">Crear uno</a></header>
          {workshops.length ? <ul className="files">{workshops.slice(0, 4).map(item => <li key={`${item.title}-${item.savedAt}`}>
            <button className="file-row" onClick={() => navigate('workshops', { open: item.title })}>
              <BookOpen size={17} aria-hidden /><span><b>{item.title}</b><small>{item.supportType === 'quiz' ? 'Quiz' : item.supportType === 'custom' ? 'A tu medida' : 'Taller'} · <LevelText level={item.targetLevel} /> · {relativeDate(item.savedAt)}</small></span>
            </button></li>)}</ul> : <EmptyState title="Aún no has creado talleres" text="Elige un material y un tema; el taller queda listo para revisar y descargar." />}
        </section>

        <section className="panel" aria-labelledby="material-title">
          <header className="panel-head"><h2 id="material-title">Material del curso</h2>{materials && materials.length > 0 && <span className="count">{materials.length}</span>}<MaterialUploadButton courseId={course.id} variant="ghost" onUploaded={items => workspace.updateMaterials(list => [...items, ...list])}>Subir</MaterialUploadButton></header>
          {materials?.length ? <ul className="files">{materials.slice(0, 4).map(material => <li key={material.id}><div className="file-row is-static"><FileText size={17} aria-hidden /><span><b>{material.fileName}</b><small>{fileSize(material.fileSize)} · {relativeDate(material.createdAt)}</small></span></div></li>)}</ul> : <EmptyState title="Sin material" text="Sube PDF, Word o TXT de tus clases. Lo uso para crear talleres sobre lo que enseñas." />}
        </section>
      </div>
    </>}
  </section>
}

function LevelText({ level }: { level?: string | null }) {
  const value = (level ?? '').toUpperCase()
  return <>{value.startsWith('L') || value.startsWith('B') ? 'refuerzo' : value.startsWith('H') || value.startsWith('A') ? 'avanzado' : 'seguimiento'}</>
}


/** Makes a card behave as a link for mouse and keyboard without nesting interactive markup inside the list. */
function linkProps(label: string, open: () => void) {
  return {
    role: 'link' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: open,
    onKeyDown: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } },
  }
}

function Stat({ icon, label, value, note, tone, onOpen, hint }: { icon: ReactNode; label: string; value: number | null; note: string; tone?: 'low' | 'medium'; onOpen: () => void; hint: string }) {
  const shown = useCountUp(value)
  return <div className={`stat stat-link${tone ? ` stat-${tone}` : ''}`} {...linkProps(`${label}: ${shown == null ? 'sin datos' : Math.round(shown)}. ${hint}`, onOpen)}>
    <dt><span className="stat-icon" aria-hidden>{icon}</span>{label}</dt>
    <dd className="num">{shown == null ? '—' : Math.round(shown)}</dd>
    <span>{note}</span>
    <ArrowUpRight className="stat-go" size={16} aria-hidden />
  </div>
}

/** The course average as a ring: the arc is the share of the scale and the colour says how it is going. */
function Ring({ value }: { value: number | null }) {
  const shown = useCountUp(value)
  const share = value == null ? 0 : Math.max(0, Math.min(1, value / 5))
  const tone = value == null ? 'none' : value < 3 ? 'low' : value < 3.8 ? 'medium' : 'high'
  const R = 40, C = 2 * Math.PI * R
  return <span className={`ring ring-${tone}`}>
    <svg viewBox="0 0 100 100" aria-hidden><circle className="ring-track" cx="50" cy="50" r={R} /><circle className="ring-arc" cx="50" cy="50" r={R} strokeDasharray={C} style={{ strokeDashoffset: C * (1 - share) }} /></svg>
    <b className="num">{shown == null ? '—' : formatScaled(toCourseScale(shown))}</b>
  </span>
}

function Donut({ low, medium, high, total }: { low: number; medium: number; high: number; total: number }) {
  const R = 42, C = 2 * Math.PI * R
  let offset = 0
  const parts = [['low', low], ['medium', medium], ['high', high]] as const
  return <div className="donut">
    <svg viewBox="0 0 110 110" role="img" aria-label={`${low} en refuerzo, ${medium} en seguimiento, ${high} con buen progreso`}>
      <circle className="donut-track" cx="55" cy="55" r={R} />
      {parts.map(([key, n], i) => { if (!n) return null; const len = n / total * C; const seg = <circle key={key} className={`donut-seg donut-${key}`} cx="55" cy="55" r={R} strokeDasharray={`${Math.max(len - 3, 1)} ${C}`} strokeDashoffset={-offset} style={{ animationDelay: `${120 + i * 140}ms` }} />; offset += len; return seg })}
    </svg>
    <span className="donut-center"><b className="num">{total}</b><small>con notas</small></span>
  </div>
}
