import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ClipboardCheck, Download, Plus, Printer, Trash2 } from 'lucide-react'
import type { PageProps } from '../App'
import { EmptyState, Spinner, useFeedback } from '../components/ui'
import { downloadText, slugify } from '../lib/files'
import { relativeDate } from '../lib/domain'
import { rubricApi, rubricHtml, type RubricDetail, type RubricDraft, type RubricResult, type RubricSummary } from '../lib/rubrics'
import { NewRubric } from './rubrics/NewRubric'
import { PublishDialog } from './rubrics/PublishDialog'
import { RubricEditor } from './rubrics/RubricEditor'
import { RubricGrader } from './rubrics/RubricGrader'

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'draft'; draft: RubricDraft } | { kind: 'open'; id: number }

/**
 * Rubrics: write them with the AI or by hand, assess each student with a click per criterion and send
 * the grades to the grade book. Inspired by the rubric generators of teacher assistants, but tied to the
 * course roster and grade book instead of a loose document.
 */
export default function RubricsPage({ workspace, navigate, params }: PageProps & { params: URLSearchParams }) {
  const { course, workshops } = workspace
  const { notify, confirm } = useFeedback()
  const fromWorkshop = params.get('taller')
  const openId = Number(params.get('id')) || null
  const [view, setView] = useState<View>(() => fromWorkshop ? { kind: 'new' } : openId ? { kind: 'open', id: openId } : { kind: 'list' })
  const [list, setList] = useState<RubricSummary[] | null>(null)
  const [detail, setDetail] = useState<RubricDetail | null>(null)
  const [draft, setDraft] = useState<RubricDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<'evaluar' | 'rubrica'>(params.get('vista') === 'rubrica' ? 'rubrica' : 'evaluar')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const courseId = course?.id ?? 0

  const loadList = useCallback(async () => {
    if (!courseId) return
    try { setList(await rubricApi.list(courseId)) } catch (error) { setList([]); notify(error instanceof Error ? error.message : 'No se pudieron cargar las rúbricas.', 'error') }
  }, [courseId, notify])

  useEffect(() => { if (view.kind === 'list') void loadList() }, [view.kind, loadList])
  useEffect(() => {
    if (view.kind !== 'open' || !courseId) return
    setDetail(null)
    rubricApi.get(courseId, view.id).then(data => { setDetail(data); setDraft(data); setDirty(false) })
      .catch(error => { notify(error instanceof Error ? error.message : 'No se encontró la rúbrica.', 'error'); setView({ kind: 'list' }) })
  }, [view, courseId, notify])

  const open = (id: number, nextTab: 'evaluar' | 'rubrica' = 'evaluar') => {
    setTab(nextTab); setView({ kind: 'open', id }); navigate('rubricas', { id: String(id), vista: nextTab })
  }
  const back = async () => {
    if (dirty && !await confirm({ title: 'Tienes cambios sin guardar', body: 'Si sales, se pierden los cambios de la rúbrica.', confirm: 'Salir sin guardar', danger: true })) return
    setDirty(false); setDetail(null); setDraft(null); setView({ kind: 'list' }); navigate('rubricas')
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      if (view.kind === 'draft') {
        const created = await rubricApi.create(courseId, draft)
        notify('Rúbrica guardada. Ya puedes evaluar a tus estudiantes con ella.')
        setDirty(false); open(created.id, 'evaluar')
      } else if (detail) {
        const updated = await rubricApi.update(courseId, detail.id, draft)
        setDetail(updated); setDraft(updated); setDirty(false)
        notify('Cambios guardados. Las notas se recalcularon con los nuevos pesos.')
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar la rúbrica.', 'error') }
    finally { setSaving(false) }
  }

  const remove = async (summary: { id: number; title: string; scored: number }) => {
    const ok = await confirm({ title: `¿Eliminar "${summary.title}"?`, body: summary.scored ? `Se borran las evaluaciones de ${summary.scored} estudiantes. Las notas que ya llevaste al libro se quedan.` : 'No tiene evaluaciones todavía.', confirm: 'Eliminar', danger: true })
    if (!ok) return
    try { await rubricApi.remove(courseId, summary.id); notify('Rúbrica eliminada.'); setView({ kind: 'list' }); navigate('rubricas'); void loadList() }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error') }
  }

  const exportSheet = (print: boolean) => {
    if (!draft || !course) return
    const html = rubricHtml(draft, course.name, detail?.levelGrades ?? [5, 4, 3, 1.5])
    if (!print) { downloadText(`${slugify(draft.title) || 'rubrica'}.html`, html, 'text/html;charset=utf-8'); return }
    const frame = Object.assign(document.createElement('iframe'), { style: 'position:fixed;width:0;height:0;border:0' })
    document.body.appendChild(frame)
    frame.contentDocument?.open(); frame.contentDocument?.write(html); frame.contentDocument?.close()
    window.setTimeout(() => { frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 1000) }, 250)
  }

  const head = <header className="page-head">
    <div><h1>Rúbricas</h1><p>Califica con criterios claros: un clic por criterio y la nota llega sola al libro de notas de {course?.name}.</p></div>
    {view.kind === 'list' && <button className="btn btn-primary" onClick={() => setView({ kind: 'new' })}><Plus size={16} aria-hidden />Nueva rúbrica</button>}
  </header>

  if (!course) return null

  if (view.kind === 'new') return <section className="page">{head}
    <NewRubric courseId={courseId} workshops={workshops} initialWorkshop={fromWorkshop ? workshops.find(w => String(w.id) === fromWorkshop || w.title === fromWorkshop) : null}
      onBack={() => { setView({ kind: 'list' }); navigate('rubricas') }}
      onDraft={next => { setDraft(next); setDirty(true); setView({ kind: 'draft', draft: next }) }} />
  </section>

  if (view.kind === 'draft' && draft) return <section className="page">{head}
    <div className="panel rubric-panel">
      <div className="rubric-bar"><button className="link-btn back-link" onClick={() => void back()}><ArrowLeft size={15} aria-hidden />Rúbricas</button>
        <p className="muted">Revisa los criterios y los niveles, cambia lo que no te convenza y guárdala.</p></div>
      <RubricEditor draft={draft} onChange={next => { setDraft(next); setDirty(true) }} onSave={() => void save()} saving={saving} dirty levelGrades={[5, 4, 3, 1.5].map(v => v / 5 * (course.maxGrade ?? 5))} isNew />
    </div>
  </section>

  if (view.kind === 'open') {
    if (!detail || !draft) return <section className="page">{head}<div className="panel page-loading"><Spinner /> Abriendo la rúbrica…</div></section>
    const done = detail.results.filter(r => detail.criteria.every(c => r.levels[String(c.id)] != null)).length
    return <section className="page">{head}
      <div className="panel rubric-panel">
        <div className="rubric-bar">
          <button className="link-btn back-link" onClick={() => void back()}><ArrowLeft size={15} aria-hidden />Rúbricas</button>
          <div className="rubric-heading"><h2>{detail.title}</h2>{detail.activityTitle && <small>Evalúa: <button className="link-btn" onClick={() => navigate('talleres', { ver: detail.activityTitle! })}>{detail.activityTitle}</button></small>}</div>
          <div className="period-tabs" role="tablist" aria-label="Vista">
            <button role="tab" aria-selected={tab === 'evaluar'} className={tab === 'evaluar' ? 'is-on' : ''} onClick={async () => { if (dirty && !await confirm({ title: 'Tienes cambios sin guardar', body: 'Guarda la rúbrica antes de evaluar para usar los cambios.', confirm: 'Descartar cambios', danger: true })) return; setDraft(detail); setDirty(false); setTab('evaluar') }}>Evaluar</button>
            <button role="tab" aria-selected={tab === 'rubrica'} className={tab === 'rubrica' ? 'is-on' : ''} onClick={() => setTab('rubrica')}>Rúbrica</button>
          </div>
          <span className="push" />
          <button className="icon-btn" onClick={() => exportSheet(true)} aria-label="Imprimir la rúbrica" title="Imprimir para los estudiantes"><Printer size={17} /></button>
          <button className="icon-btn" onClick={() => exportSheet(false)} aria-label="Descargar la rúbrica" title="Descargar"><Download size={17} /></button>
          <button className="icon-btn icon-danger" onClick={() => void remove({ id: detail.id, title: detail.title, scored: done })} aria-label="Eliminar rúbrica"><Trash2 size={17} /></button>
        </div>
        {detail.columnName && <p className="sheet-notice">Publicada en <b>{detail.period}</b>, columna <b>{detail.columnName}</b>. Si cambias evaluaciones, vuelve a llevarlas al libro para actualizar las notas.</p>}
        {tab === 'evaluar'
          ? <RubricGrader key={detail.id} courseId={courseId} rubric={detail} onPublish={() => setPublishing(true)}
              onResults={(results: RubricResult[]) => setDetail(current => current ? { ...current, results } : current)} />
          : <RubricEditor draft={draft} onChange={next => { setDraft(next); setDirty(true) }} onSave={() => void save()} saving={saving} dirty={dirty} levelGrades={detail.levelGrades} isNew={false} />}
      </div>
      {publishing && <PublishDialog courseId={courseId} rubric={detail} done={done} onClose={() => setPublishing(false)}
        onPublished={period => { setPublishing(false); setDetail({ ...detail, period }); void workspace.refreshCourse() }} />}
    </section>
  }

  return <section className="page">{head}
    {list == null ? <div className="panel page-loading"><Spinner /> Cargando rúbricas…</div>
      : !list.length ? <div className="panel"><EmptyState art="read" title="Califica más rápido y más justo" text="Una rúbrica dice qué se espera en cada criterio. Descríbeme la actividad, la escribo con cuatro niveles y luego calificas con un clic por criterio. Las notas van solas al libro de notas."
          action={<button className="btn btn-primary" onClick={() => setView({ kind: 'new' })}><Plus size={16} aria-hidden />Crear mi primera rúbrica</button>} /></div>
      : <ul className="rubric-list">{list.map(item => <li key={item.id}>
          <button className="rubric-card" onClick={() => open(item.id)}>
            <span className="rubric-card-icon"><ClipboardCheck size={20} aria-hidden /></span>
            <span className="rubric-card-main"><b>{item.title}</b>
              <small>{item.activityTitle ? `Evalúa: ${item.activityTitle} · ` : ''}{item.criteria} criterios · {item.columnName ? `en ${item.period}, columna ${item.columnName}` : 'sin llevar al libro'} · {relativeDate(item.updatedAt)}</small></span>
            <span className="rubric-card-progress"><span className="num">{item.scored}/{item.students}</span><small>evaluados</small>
              <span className="gen-bar" aria-hidden><span style={{ transform: `scaleX(${item.students ? item.scored / item.students : 0})` }} /></span></span>
          </button>
        </li>)}</ul>}
  </section>
}
