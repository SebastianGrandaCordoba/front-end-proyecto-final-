import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BookOpen, Check, ChevronDown, Search, Download, FileText, RotateCw, Sparkles, Trash2, X } from 'lucide-react'
import { request, type AcademicLevel, type CourseMaterial, type GeneratedWorkshop } from '../api'
import type { PageProps } from '../App'
import { MAX_MATERIAL_BYTES, MaterialUploadButton } from '../app/actions'
import type { SupportMode, WorkshopIntent } from '../app/types'
import Owl from '../components/Owl'
import { EmptyState, Field, LevelPill, Segmented, Spinner, useFeedback } from '../components/ui'
import { downloadWorkshopDocument, workshopAsText } from '../lib/files'
import { fileSize, firstName, levelLabel, levelOf, plural, relativeDate } from '../lib/domain'
import { WorkshopView } from './workshops/WorkshopView'

type Tab = 'crear' | 'biblioteca'
const stages = [
  { at: 0, text: 'Leyendo tu material…' },
  { at: 6, text: 'Buscando los conceptos clave…' },
  { at: 14, text: 'Diseñando las actividades…' },
  { at: 26, text: 'Escribiendo las preguntas y respuestas…' },
  { at: 45, text: 'Ya casi. Si el servicio estaba dormido, tarda un poco más…' },
]

export default function WorkshopsPage({ workspace, intent, clearIntent, params }: PageProps & { intent: WorkshopIntent | null; clearIntent: () => void; params: URLSearchParams }) {
  const { course, materials, summary, insights, workshops } = workspace
  const { notify, confirm } = useFeedback()
  const viewTitle = params.get('ver')
  const [tab, setTab] = useState<Tab>('crear')
  const [mode, setMode] = useState<SupportMode>(intent?.mode ?? 'workshop')
  const [level, setLevel] = useState<AcademicLevel>(intent?.level ?? (summary.low ? 'LOW' : 'MEDIUM'))
  const [target, setTarget] = useState(intent?.student ?? null)
  const [topic, setTopic] = useState(intent?.topic ?? '')
  const [objective, setObjective] = useState('')
  const [subject, setSubject] = useState(course?.name ?? '')
  const [selected, setSelected] = useState<number[]>([])
  const [result, setResult] = useState<GeneratedWorkshop | null>(() => viewTitle ? workshops.find(item => item.title === viewTitle) ?? null : null)
  const [generating, setGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const abort = useRef<AbortController | null>(null)
  const autoStarted = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const sortedMaterials = useMemo(() => [...(materials ?? [])].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')), [materials])
  const selectedSize = sortedMaterials.filter(m => selected.includes(m.id)).reduce((sum, m) => sum + m.fileSize, 0)

  useEffect(() => { setSubject(course?.name ?? '') }, [course?.id])
  // Pre-select the newest material so the teacher can generate in one click.
  useEffect(() => { if (!selected.length && sortedMaterials.length) setSelected([sortedMaterials[0].id]) }, [sortedMaterials])
  useEffect(() => {
    if (!viewTitle) return
    const found = workshops.find(item => item.title === viewTitle)
    if (found) { setResult(found); setTab('crear') }
  }, [viewTitle, workshops])
  useEffect(() => {
    if (!intent) return
    setMode(intent.mode); setLevel(intent.level); setTarget(intent.student ?? null)
    if (intent.topic) setTopic(intent.topic)
    setTab('crear'); setResult(null); setError('')
  }, [intent])
  useEffect(() => {
    if (!generating) return
    const started = Date.now()
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [generating])
  useEffect(() => () => abort.current?.abort(), [])

  // From a student's card: reuse a saved proposal or generate right away with the newest material.
  useEffect(() => {
    if (!intent?.autoStart || !intent.student || autoStarted.current || materials == null) return
    autoStarted.current = true
    const saved = workshops.find(item => item.targetStudentId === intent.student!.id && item.supportType === intent.mode)
    if (saved) { setResult(saved); notify('Ya tenías una propuesta para este estudiante. Puedes revisarla o crear otra.', 'info'); return }
    if (sortedMaterials.length) void generate({ materialIds: [sortedMaterials[0].id], mode: intent.mode, level: intent.level, student: intent.student })
  }, [intent, materials])

  const toggle = (material: CourseMaterial) => {
    setSelected(current => {
      if (current.includes(material.id)) return current.filter(id => id !== material.id)
      if (current.length >= 6) { notify('Puedes combinar hasta 6 materiales.', 'error'); return current }
      if (selectedSize + material.fileSize > MAX_MATERIAL_BYTES) { notify('Juntos no pueden pasar de 10 MB.', 'error'); return current }
      return [...current, material.id]
    })
  }

  const removeMaterial = async (material: CourseMaterial) => {
    if (!course) return
    const ok = await confirm({ title: `¿Quitar “${material.fileName}”?`, body: 'Se borra de la biblioteca de este curso. Los talleres ya creados no cambian.', confirm: 'Quitar material', danger: true })
    if (!ok) return
    try {
      await request<void>(`/api/courses/${course.id}/materials/${material.id}`, { method: 'DELETE' })
      workspace.updateMaterials(list => list.filter(item => item.id !== material.id))
      setSelected(current => current.filter(id => id !== material.id))
      notify('Material quitado.')
    } catch (err) { notify(err instanceof Error ? err.message : 'No se pudo quitar el material.', 'error') }
  }

  async function generate(options: { materialIds?: number[]; mode?: SupportMode; level?: AcademicLevel; student?: WorkshopIntent['student'] } = {}) {
    if (!course) return
    const ids = options.materialIds ?? selected
    const useMode = options.mode ?? mode
    const useLevel = options.level ?? level
    const student = options.student ?? target
    if (!ids.length) { setError('Elige al menos un material o sube uno nuevo.'); return }
    const topicText = topic.trim() || (useMode === 'quiz' ? 'conceptos clave del material' : 'conceptos clave del material de clase')
    const goal = objective.trim() || (useMode === 'quiz'
      ? `Crea un quiz corto de comprobación: exactamente 3 preguntas claras sobre ${topicText}, para nivel ${levelLabel[useLevel].toLowerCase()}, con opciones, respuesta correcta y explicación breve. Evalúa comprensión y aplicación, no memoria.`
      : useLevel === 'LOW' ? `Comprender ${topicText} con ejemplos guiados y demostrarlo en una comprobación breve.`
        : useLevel === 'MEDIUM' ? `Consolidar ${topicText} y aplicarlo en ejercicios de dificultad creciente.`
          : `Profundizar en ${topicText} y resolver un reto de aplicación.`)
    const context = summary.average == null
      ? `Curso: ${course.name}. Todavía no hay notas; el docente pide una actividad preventiva.`
      : student
        ? `Curso: ${course.name}. Propuesta individual para un estudiante con nivel ${levelLabel[useLevel].toLowerCase()} según su promedio. No se envían identidad ni notas individuales. Tema: ${topicText}.`
        : `Curso: ${course.name}. ${summary.graded} estudiantes con notas: ${summary.low} en refuerzo, ${summary.medium} en seguimiento y ${summary.high} con buen progreso. Promedio general ${summary.average.toFixed(2)} sobre 5. Tema priorizado: ${topicText}.`

    const form = new FormData()
    form.append('subject', (subject.trim() || course.name).slice(0, 120))
    form.append('targetLevel', useLevel)
    form.append('learningObjective', goal.slice(0, 1000))
    form.append('learningContext', context.slice(0, 2500))
    form.append('generationType', useMode === 'quiz' ? 'QUIZ' : 'WORKSHOP')
    if (ids.length > 1) ids.forEach(id => form.append('materialIds', String(id)))
    const path = ids.length === 1 ? `/api/courses/${course.id}/materials/${ids[0]}/generate-workshop` : `/api/courses/${course.id}/materials/generate-workshop`

    abort.current?.abort()
    abort.current = new AbortController()
    setGenerating(true); setError(''); setResult(null)
    window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    try {
      const response = await request<GeneratedWorkshop>(path, { method: 'POST', body: form, signal: abort.current.signal })
      const named = student ? {
        ...response,
        ...(useMode === 'quiz' ? { title: `Quiz · ${topic.trim() || response.subject} · ${firstName(student.name)}` } : { title: `${response.title} · ${firstName(student.name)}` }),
        targetStudentId: student.id } : response
      const saved = workspace.saveWorkshop({ ...named, supportType: useMode })
      setResult(saved)
      clearIntent()
      notify(useMode === 'quiz' ? 'Quiz listo. Revísalo antes de usarlo.' : 'Taller listo. Revísalo antes de usarlo.')
    } catch (err) {
      if (abort.current?.signal.aborted) { setError('Cancelaste la generación.'); return }
      setError(err instanceof Error ? err.message : 'No se pudo generar. Inténtalo de nuevo.')
    } finally { setGenerating(false) }
  }

  const submit = (event: FormEvent) => { event.preventDefault(); void generate() }
  const stage = [...stages].reverse().find(item => elapsed >= item.at)?.text ?? stages[0].text
  const topicIdeas = insights.filter(subject => subject.average < 4).slice(0, 3)

  return <section className="page">
    <header className="page-head">
      <div><h1>Talleres y quizzes</h1><p>Creo actividades a partir del material de {course?.name}. Tú las revisas antes de usarlas.</p></div>
      <div className="tabs" role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={tab === 'crear'} className={tab === 'crear' ? 'is-on' : ''} onClick={() => setTab('crear')}>Crear</button>
        <button role="tab" aria-selected={tab === 'biblioteca'} className={tab === 'biblioteca' ? 'is-on' : ''} onClick={() => setTab('biblioteca')}>Guardados <span className="seg-count">{workshops.length}</span></button>
      </div>
    </header>

    {tab === 'biblioteca' ? <Library items={workshops} onOpen={item => { setResult(item); setTab('crear') }} onRemove={async item => {
      if (await confirm({ title: '¿Borrar esta propuesta?', body: `“${item.title}” se quitará de tu biblioteca en este navegador.`, confirm: 'Borrar', danger: true })) { workspace.removeWorkshop(item.title); if (result?.title === item.title) setResult(null) }
    }} /> : <div className="builder">
      <form className="builder-form panel" onSubmit={submit} aria-label="Crear actividad">
        {target && <div className="target-chip"><span>Para <b>{target.name}</b> · <LevelPill level={target.level} hasGrades={target.hasGrades} /></span><button type="button" className="icon-btn" onClick={() => { setTarget(null); clearIntent() }} aria-label="Quitar estudiante"><X size={15} /></button></div>}

        <fieldset className="step"><legend><span className="step-n">1</span>Qué quieres crear</legend>
          <Segmented label="Tipo" value={mode} onChange={setMode} options={[{ value: 'workshop', label: 'Taller de práctica' }, { value: 'quiz', label: 'Quiz de 3 preguntas' }]} />
          <p className="step-hint">{mode === 'quiz' ? 'Preguntas de opción múltiple con clave para ti. Ideal para comprobar si un tema quedó claro.' : 'Objetivos, tres actividades guiadas y una comprobación final. Ideal para repasar un tema.'}</p>
        </fieldset>

        <fieldset className="step"><legend><span className="step-n">2</span>Para qué nivel</legend>
          <Segmented label="Nivel" value={level} onChange={setLevel} options={[
            { value: 'LOW', label: 'Refuerzo', count: summary.gradeCount ? summary.low : undefined },
            { value: 'MEDIUM', label: 'Seguimiento', count: summary.gradeCount ? summary.medium : undefined },
            { value: 'HIGH', label: 'Reto', count: summary.gradeCount ? summary.high : undefined },
          ]} />
        </fieldset>

        <fieldset className="step"><legend><span className="step-n">3</span>Con qué material</legend>
          {materials == null ? <div className="mini-loading"><Spinner /> Cargando material…</div>
            : sortedMaterials.length ? <ul className="materials" aria-label="Material del curso">{sortedMaterials.map(material => {
              const on = selected.includes(material.id)
              return <li key={material.id} className={on ? 'is-on' : ''}>
                <label className="material">
                  <input type="checkbox" checked={on} onChange={() => toggle(material)} />
                  <span className="check" aria-hidden>{on && <Check size={12} strokeWidth={3} />}</span>
                  <FileText size={16} aria-hidden />
                  <span className="material-name"><b>{material.fileName}</b><small>{fileSize(material.fileSize)} · {relativeDate(material.createdAt)}</small></span>
                </label>
                <button type="button" className="icon-btn icon-danger" onClick={() => void removeMaterial(material)} aria-label={`Quitar ${material.fileName}`}><Trash2 size={15} /></button>
              </li>
            })}</ul> : <p className="step-hint">Este curso aún no tiene material. Sube un PDF, Word o TXT del tema.</p>}
          <div className="step-row">
            <MaterialUploadButton courseId={course?.id ?? null} variant="ghost" onUploaded={items => { workspace.updateMaterials(list => [...items, ...list]); setSelected(items.slice(0, 6).map(item => item.id)) }}>Subir material nuevo</MaterialUploadButton>
            {selected.length > 0 && <small className="muted">{plural(selected.length, 'seleccionado', 'seleccionados')} · {fileSize(selectedSize)} de 10 MB</small>}
          </div>
        </fieldset>

        <fieldset className="step"><legend><span className="step-n">4</span>Sobre qué tema</legend>
          <Field label="Tema" hint="Lo que están viendo en clase, en pocas palabras."><input value={topic} onChange={event => setTopic(event.target.value)} maxLength={120} placeholder="Ej. ciclos for, derivadas, fotosíntesis…" autoComplete="off" /></Field>
          {topicIdeas.length > 0 && !topic && <div className="ideas"><span>Según las notas, cuestan más:</span>{topicIdeas.map(idea => <button type="button" key={idea.id} className="chip" onClick={() => setTopic(idea.name)}>{idea.name}</button>)}</div>}
          <details className="more">
            <summary>Más opciones <ChevronDown size={15} aria-hidden /></summary>
            <Field label="Qué quieres que logren" optional><textarea rows={3} maxLength={1000} value={objective} onChange={event => setObjective(event.target.value)} placeholder="Ej. Que resuelvan un ciclo y expliquen cuándo termina…" /></Field>
            <Field label="Materia" hint="Aparece en el encabezado del taller."><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} autoComplete="off" /></Field>
          </details>
        </fieldset>

        {error && <div className="form-error" role="alert"><b>No se pudo generar.</b> {error}</div>}
        <button className="btn btn-primary btn-large" disabled={generating || !selected.length}>
          {generating ? <Spinner /> : <Sparkles size={18} aria-hidden />}
          {generating ? 'Generando…' : `${mode === 'quiz' ? 'Crear quiz' : 'Crear taller'}${selected.length > 1 ? ` con ${selected.length} materiales` : ''}`}
        </button>
        <p className="privacy-note">La IA recibe el material y un resumen del curso sin nombres ni notas individuales.</p>
      </form>

      <div className="builder-result" ref={resultRef} aria-live="polite">
        {generating ? <div className="panel generating">
          <Owl pose="think" size={132} />
          <h2>{stage}</h2>
          <p className="num">{elapsed} s · suele tardar entre 15 y 40 segundos</p>
          <div className="gen-bar" aria-hidden><span style={{ width: `${Math.min(95, elapsed * 2.2)}%` }} /></div>
          <button className="btn btn-ghost btn-small" onClick={() => abort.current?.abort()}>Cancelar</button>
        </div>
          : result ? <WorkshopView workshop={result} onCopy={async () => { try { await navigator.clipboard.writeText(workshopAsText(result)); notify('Texto copiado.') } catch { notify('No se pudo copiar.', 'error') } }} onNew={() => setResult(null)} onEdit={next => { workspace.removeWorkshop(result.title); setResult(workspace.saveWorkshop(next)) }} onQuiz={() => { setMode('quiz'); setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            : error ? <div className="panel"><EmptyState icon={<RotateCw size={20} />} title="Vuelve a intentarlo" text="A veces el servicio tarda en despertar. Tu selección sigue lista." action={<button className="btn btn-secondary" onClick={() => void generate()}>Reintentar</button>} /></div>
              : <div className="panel preview"><EmptyState art="read" title="Aquí aparecerá tu actividad" text="Con objetivos, actividades paso a paso y preguntas con su respuesta. Podrás descargarla para tus estudiantes y una clave solo para ti." /></div>}
      </div>
    </div>}
  </section>
}


function Library({ items, onOpen, onRemove }: { items: GeneratedWorkshop[]; onOpen: (item: GeneratedWorkshop) => void; onRemove: (item: GeneratedWorkshop) => void }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'todos' | 'workshop' | 'quiz'>('todos')
  if (!items.length) return <div className="panel"><EmptyState icon={<BookOpen size={22} />} title="Todavía no hay propuestas guardadas" text="Cada taller o quiz que generes se guarda aquí, por curso, en este navegador." /></div>
  const q = query.trim().toLowerCase()
  const visible = items.filter(item => (kind === 'todos' || (item.supportType ?? 'workshop') === kind) && (!q || `${item.title} ${item.subject}`.toLowerCase().includes(q)))
  return <>
    <div className="toolbar">
      <label className="search"><Search size={16} aria-hidden /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en tus talleres…" aria-label="Buscar talleres" /></label>
      <Segmented label="Tipo" value={kind} onChange={setKind} options={[{ value: 'todos', label: 'Todos', count: items.length }, { value: 'workshop', label: 'Talleres', count: items.filter(i => i.supportType !== 'quiz').length }, { value: 'quiz', label: 'Quizzes', count: items.filter(i => i.supportType === 'quiz').length }]} />
    </div>
    {!visible.length && <div className="panel"><EmptyState title="Nada coincide" text="Prueba con otra palabra o cambia el tipo." /></div>}
    <ul className="library">{visible.map(item => <li key={`${item.title}-${item.savedAt}`} className="panel lib-item">
    <button className="lib-open" onClick={() => onOpen(item)}>
      <span className="lib-type">{item.supportType === 'quiz' ? 'Quiz' : 'Taller'} · {levelLabel[levelOf(item.targetLevel)]}</span>
      <b>{item.title}</b>
      <small>{item.subject} · {relativeDate(item.savedAt)}</small>
    </button>
    <div className="lib-actions">
      <button className="icon-btn" onClick={() => downloadWorkshopDocument(item)} aria-label={`Descargar ${item.title}`} title="Descargar para estudiantes"><Download size={16} /></button>
      <button className="icon-btn icon-danger" onClick={() => onRemove(item)} aria-label={`Borrar ${item.title}`} title="Borrar"><Trash2 size={16} /></button>
    </div>
  </li>)}</ul>
  </>
}
