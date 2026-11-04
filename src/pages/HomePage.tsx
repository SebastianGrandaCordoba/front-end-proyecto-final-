import { ArrowRight, BookOpen, Check, FileText } from 'lucide-react'
import type { TeacherProfile } from '../api'
import type { PageProps } from '../App'
import FairTeamMark from '../FairTeamMark'
import { ImportButton, MaterialUploadButton } from '../app/actions'
import { headline, recommendations, setupSteps, type Recommendation } from '../lib/assistant'
import { firstName, fileSize, formatGrade, greetingFor, levelRule, plural, relativeDate, todayLabel } from '../lib/domain'
import { Avatar, EmptyState } from '../components/ui'

export default function HomePage({ workspace, navigate, startWorkshop, review, user }: PageProps & { user: TeacherProfile }) {
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
      case 'create-course': return navigate('cursos', courses.length ? {} : { nuevo: '1' })
      case 'support-group': return startWorkshop({ mode: 'workshop', level: 'LOW', group: summary.low, topic: weakest && weakest.average < 3.5 ? weakest.name : undefined })
      case 'open-followup': return navigate('seguimiento')
      case 'open-students-ungraded': return navigate('estudiantes', { filtro: 'sin-notas' })
      case 'open-workshop': return navigate('talleres', { ver: rec.action.title })
      case 'open-teams': return navigate('equipos')
      default: return undefined
    }
  }

  const actionControl = (rec: Recommendation, primary: boolean) => {
    const variant = primary ? 'primary' : 'secondary'
    if (rec.action.kind === 'import-roster') return <ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant={variant}>{rec.cta}</ImportButton>
    if (rec.action.kind === 'import-grades') return <ImportButton kind="grades" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant={variant}>{rec.cta}</ImportButton>
    if (rec.action.kind === 'upload-material') return <MaterialUploadButton courseId={course?.id ?? null} onUploaded={items => workspace.updateMaterials(list => [...items, ...list])} variant={variant}>{rec.cta}</MaterialUploadButton>
    return <button className={`btn btn-${variant}`} onClick={() => runAction(rec)}>{rec.cta}<ArrowRight size={16} aria-hidden /></button>
  }

  const [lead, ...rest] = recs

  return <section className="page page-home">
    <header className="greeting">
      <h1>{greetingFor()}, {firstName(user.name)}.</h1>
      <p>{loading ? 'Revisando tu curso…' : headline(input)} <span className="greeting-date">· {todayLabel()}</span></p>
    </header>

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
      <dl className="kpis" aria-label={`Resumen de ${course.name}`}>
        <div><dt>Estudiantes</dt><dd>{loading ? '—' : summary.students}</dd><span>{summary.graded ? `${summary.graded} con notas` : 'sin notas aún'}</span></div>
        <div><dt>Promedio del curso</dt><dd>{summary.average == null ? '—' : formatGrade(summary.average)}<small> / 5</small></dd><span>{summary.gradeCount ? plural(summary.gradeCount, 'nota cargada', 'notas cargadas') : 'carga las notas'}</span></div>
        <div className={summary.low ? 'kpi-alert' : ''}><dt>Necesitan refuerzo</dt><dd>{summary.gradeCount ? summary.low : '—'}</dd><span>{levelRule.LOW.toLowerCase()}</span></div>
        <div><dt>Material guardado</dt><dd>{materials == null ? '—' : materials.length}</dd><span>{materials?.length ? fileSize(materials.reduce((s, m) => s + m.fileSize, 0)) + ' en total' : 'para crear talleres'}</span></div>
      </dl>

      <div className="home-grid">
        <section className="panel panel-wide" aria-labelledby="support-title">
          <header className="panel-head"><h2 id="support-title">Necesitan apoyo</h2>{needSupport.length > 0 && <span className="count">{needSupport.length}</span>}<a className="link" href="#/seguimiento">Ver seguimiento</a></header>
          {needSupport.length ? <ul className="people">{needSupport.slice(0, 5).map(student => <li key={student.id}>
            <button className="person" onClick={() => review(student)}>
              <Avatar name={student.name} />
              <span className="person-name"><b>{student.name}</b><small>{plural(student.gradeCount, 'nota', 'notas')}</small></span>
              <span className="person-grade num">{formatGrade(student.average)}</span>
              <span className="person-cta">Ver recomendación</span>
            </button>
          </li>)}</ul> : <EmptyState title={summary.gradeCount ? 'Nadie está por debajo de 3,0' : 'Aún no hay notas'} text={summary.gradeCount ? 'Cuando alguien baje de 3,0 aparecerá aquí con una recomendación.' : 'Carga las notas y te mostraré aquí quién necesita apoyo.'} />}
        </section>

        <section className="panel" aria-labelledby="levels-title">
          <header className="panel-head"><h2 id="levels-title">Cómo va el grupo</h2></header>
          {summary.graded ? <>
            <div className="levelbar" role="img" aria-label={`${summary.low} en refuerzo, ${summary.medium} en seguimiento, ${summary.high} con buen progreso`}>
              {(['low', 'medium', 'high'] as const).map(key => summary[key] > 0 && <span key={key} className={`levelbar-${key}`} style={{ flexGrow: summary[key] }} />)}
            </div>
            <ul className="legend">
              <li><i className="dot dot-low" />Refuerzo<b className="num">{summary.low}</b></li>
              <li><i className="dot dot-medium" />Seguimiento<b className="num">{summary.medium}</b></li>
              <li><i className="dot dot-high" />Buen progreso<b className="num">{summary.high}</b></li>
              {summary.ungraded > 0 && <li><i className="dot dot-none" />Sin notas<b className="num">{summary.ungraded}</b></li>}
            </ul>
            {insights.length > 0 && <div className="subjects"><h3>Promedio por tema</h3><ul>{insights.slice(0, 4).map(subject => <li key={subject.id}><span>{subject.name}</span><b className={`num${subject.average < 3 ? ' is-low' : ''}`}>{formatGrade(subject.average)}</b></li>)}</ul></div>}
          </> : <EmptyState title="Sin datos todavía" text="La distribución aparece cuando cargas notas." />}
        </section>

        <section className="panel" aria-labelledby="recent-title">
          <header className="panel-head"><h2 id="recent-title">Talleres recientes</h2>{workshops.length > 0 && <span className="count">{workshops.length}</span>}<a className="link" href="#/talleres">Crear uno</a></header>
          {workshops.length ? <ul className="files">{workshops.slice(0, 4).map(item => <li key={`${item.title}-${item.savedAt}`}>
            <button className="file-row" onClick={() => navigate('talleres', { ver: item.title })}>
              <BookOpen size={17} aria-hidden /><span><b>{item.title}</b><small>{item.supportType === 'quiz' ? 'Quiz' : 'Taller'} · <LevelText level={item.targetLevel} /> · {relativeDate(item.savedAt)}</small></span>
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

function LevelText({ level }: { level: string }) {
  const value = level.toUpperCase()
  return <>{value.startsWith('L') || value.startsWith('B') ? 'refuerzo' : value.startsWith('H') || value.startsWith('A') ? 'avanzado' : 'seguimiento'}</>
}

