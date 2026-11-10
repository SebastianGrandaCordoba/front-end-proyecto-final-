import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, ChevronDown, FileText, RotateCw, Sparkles, Trash2, X } from 'lucide-react'
import { request, type AcademicLevel, type CourseMaterial, type GeneratedWorkshop } from '../api'
import type { PageProps } from '../App'
import { MAX_MATERIAL_BYTES, MaterialUploadButton } from '../app/actions'
import type { SupportMode, WorkshopIntent } from '../app/types'
import Owl from '../components/Owl'
import { EmptyState, Field, LevelPill, Segmented, Spinner, useFeedback } from '../components/ui'
import { workshopAsText } from '../lib/files'
import { fileSize, firstName, levelLabel, plural, relativeDate } from '../lib/domain'
import { WorkshopView } from './workshops/WorkshopView'
import { StylePicker } from './workshops/StylePicker'
import { ACTIVITY_STYLES, AREA_EXAMPLES, detectArea, goalFor, isExtended, stylesFor, type AcademicArea, type ActivityStyleId } from '../lib/activityStyles'
import { Library } from './workshops/Library'
import { KindPicker } from './workshops/KindPicker'
import { MIN_PROMPT, PromptBox } from './workshops/PromptBox'

type Tab = 'crear' | 'biblioteca'
const stages = [
  { at: 0, text: 'Leyendo tu material…' },
  { at: 6, text: 'Buscando los conceptos clave…' },
  { at: 14, text: 'Diseñando las actividades…' },
  { at: 26, text: 'Escribiendo pistas, entregas y preguntas…' },
  { at: 42, text: 'Revisando que todo tenga sentido…' },
  { at: 60, text: 'Ya casi. Los talleres largos tardan un poco más…' },
]

export default function WorkshopsPage({ workspace, navigate, intent, clearIntent, params }: PageProps & { intent: WorkshopIntent | null; clearIntent: () => void; params: URLSearchParams }) {
  const { course, materials, summary, insights, workshops } = workspace
  const { notify, confirm } = useFeedback()
  const viewTitle = params.get('ver')
  const [tab, setTab] = useState<Tab>('crear')
  const [mode, setMode] = useState<SupportMode>(intent?.mode ?? 'workshop')
  const [styles, setStyles] = useState<ActivityStyleId[]>(['GUIDED'])
  // The kinds of work offered depend on the subject: a philosophy course never sees "deploy an app".
  const detectedArea = useMemo(() => detectArea(course?.name, course?.description, ...insights.map(subject => subject.name)), [course?.name, course?.description, insights])
  const areaKey = `fairteam.area.${course?.id ?? 'none'}`
  const [area, setAreaState] = useState<AcademicArea>(() => (localStorage.getItem(areaKey) as AcademicArea | null) ?? detectedArea)
  useEffect(() => { setAreaState((localStorage.getItem(areaKey) as AcademicArea | null) ?? detectedArea) }, [areaKey, detectedArea])
  const setArea = (next: AcademicArea) => {
    localStorage.setItem(areaKey, next); setAreaState(next)
    const allowed = new Set(stylesFor(next).map(style => style.id))
    setStyles(current => { const kept = current.filter(id => allowed.has(id)); return kept.length ? kept : ['GUIDED'] })
  }
  const [level, setLevel] = useState<AcademicLevel>(intent?.level ?? (summary.low ? 'LOW' : 'MEDIUM'))
  const [target, setTarget] = useState(intent?.student ?? null)
  const [topic, setTopic] = useState(intent?.topic ?? '')
  const [objective, setObjective] = useState('')
  const [prompt, setPrompt] = useState('')
  const [extra, setExtra] = useState('')
  const [subject, setSubject] = useState(course?.name ?? '')
  const [selected, setSelected] = useState<number[]>([])
  const [result, setResult] = useState<GeneratedWorkshop | null>(() => viewTitle ? workshops.find(item => item.title === viewTitle) ?? null : null)
  const [generating, setGenerating] = useState(false)
  // Closing the tab mid-generation would lose the result; ask first.
  useEffect(() => {
    if (!generating) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [generating])
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

  useEffect(() => { if (intent?.autoStart) autoStarted.current = false }, [intent])
  // From Búho or a student's card: do the work right away. With material it uses the newest file; without
  // material it writes the activity from the topic, so the teacher never lands on a form that waits for a click.
  useEffect(() => {
    if (!intent?.autoStart || autoStarted.current || materials == null) return
    autoStarted.current = true
    if (intent.student) {
      const saved = workshops.find(item => item.targetStudentId === intent.student!.id && item.supportType === intent.mode)
      if (saved) { setResult(saved); notify('Ya tenías una propuesta para este estudiante. Puedes revisarla o crear otra.', 'info'); return }
    }
    const subject = intent.topic?.trim() || topicIdeas[0]?.name || ''
    if (sortedMaterials.length) {
      void generate({ materialIds: [sortedMaterials[0].id], mode: intent.mode, level: intent.level, student: intent.student, topic: subject })
    } else {
      // No material: written from the topic (the one that costs the course the most if none was named).
      const about = subject || course?.name || 'el tema de la clase'
      setTopic(about); setSelected([])
      void generate({ materialIds: [], mode: intent.mode, level: intent.level, student: intent.student, topic: about })
    }
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

  async function generate(options: { materialIds?: number[]; mode?: SupportMode; level?: AcademicLevel; student?: WorkshopIntent['student']; variantOf?: GeneratedWorkshop; topic?: string; prompt?: string } = {}) {
    if (!course) return
    const ids = options.materialIds ?? selected
    const useMode = options.mode ?? mode
    const useLevel = options.level ?? level
    const student = options.student ?? target
    const custom = useMode === 'custom'
    const customPrompt = options.prompt ?? prompt
    if (!ids.length && !custom && !(options.topic ?? topic).trim()) { setError('Elige un material o escribe el tema: sin material, lo armo a partir del tema.'); return }
    if (custom && customPrompt.trim().length < MIN_PROMPT) { setError('Cuéntame en una o dos frases qué taller quieres.'); return }
    const topicText = (options.topic ?? topic).trim() || (useMode === 'quiz' ? 'conceptos clave del material' : 'conceptos clave del material de clase')
    const workStyles = useMode === 'workshop' ? styles : []
    const goal = custom ? objective.trim() : objective.trim() || (useMode === 'workshop' && goalFor(workStyles, topicText)) || (useMode === 'quiz'
      ? `Comprobar si ${topicText} quedó claro, con preguntas de comprensión y aplicación para nivel ${levelLabel[useLevel].toLowerCase()}.`
      : useLevel === 'LOW' ? `Comprender ${topicText} con ejemplos guiados y demostrarlo en una comprobación breve.`
        : useLevel === 'MEDIUM' ? `Consolidar ${topicText} y aplicarlo en ejercicios de dificultad creciente.`
          : `Profundizar en ${topicText} y resolver un reto de aplicación.`)
    const context = summary.average == null
      ? `Curso: ${course.name}. Todavía no hay notas; el docente pide una actividad preventiva.`
      : student
        ? `Curso: ${course.name}. Propuesta individual para un estudiante con nivel ${levelLabel[useLevel].toLowerCase()} según su promedio. No se envían identidad ni notas individuales. Tema: ${topicText}.`
        : `Curso: ${course.name}. ${summary.graded} estudiantes con notas: ${summary.low} en refuerzo, ${summary.medium} en seguimiento y ${summary.high} con buen progreso.${custom ? '' : ` Tema priorizado: ${topicText}.`}`

    const form = new FormData()
    form.append('subject', (subject.trim() || course.name).slice(0, 120))
    form.append('targetLevel', useLevel)
    form.append('learningObjective', goal.slice(0, 1000))
    form.append('learningContext', context.slice(0, 2500))
    form.append('generationType', custom ? 'CUSTOM' : useMode === 'quiz' ? 'QUIZ' : 'WORKSHOP')
    if (workStyles.length) form.append('activityStyles', workStyles.join(','))
    const variant = options.variantOf
    // A level variant keeps the topic and structure of the original and only moves the difficulty.
    const instructions = [
      variant?.teacherPrompt ?? (custom ? customPrompt : extra),
      variant ? `Es una versión de nivel ${levelLabel[useLevel].toLowerCase()} del trabajo "${variant.title}": conserva el tema, el tipo de actividades y la duración; cambia solo la dificultad, el apoyo y los ejemplos.` : '',
    ].map(text => text.trim()).filter(Boolean).join('\n\n')
    if (instructions) form.append('teacherPrompt', instructions.slice(0, 2000))
    if (ids.length > 1) ids.forEach(id => form.append('materialIds', String(id)))
    // One material, several, or none at all for a request written by the teacher.
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
        targetStudentId: student.id } : variant ? { ...response, title: `${response.title} · ${({ LOW: 'Refuerzo', MEDIUM: 'Seguimiento', HIGH: 'Reto' } as const)[useLevel]}` } : response
      const topicName = (options.topic ?? topic).trim() || (custom ? null : topicIdeas[0]?.name ?? null)
      const saved = await workspace.saveWorkshop({ ...named, topic: topicName, supportType: useMode, activityStyles: workStyles, ...(instructions ? { teacherPrompt: instructions } : {}) })
      setResult(saved)
      clearIntent()
      notify(useMode === 'quiz' ? 'Quiz listo. Revísalo antes de usarlo.' : 'Listo. Revísalo antes de usarlo.')
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
      <div><h1>Talleres y quizzes</h1><p>Creo talleres, quizzes o lo que me pidas para {course?.name}. Tú los revisas antes de usarlos.</p></div>
      <div className="tabs" role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={tab === 'crear'} className={tab === 'crear' ? 'is-on' : ''} onClick={() => setTab('crear')}>Crear</button>
        <button role="tab" aria-selected={tab === 'biblioteca'} className={tab === 'biblioteca' ? 'is-on' : ''} onClick={() => setTab('biblioteca')}>Guardados <span className="seg-count">{workshops.length}</span></button>
      </div>
    </header>

    {tab === 'biblioteca' ? <Library items={workshops} onOpen={item => { setResult(item); setTab('crear') }} onRemove={async item => {
      if (await confirm({ title: '¿Borrar esta propuesta?', body: `“${item.title}” se quitará de tu biblioteca.${item.rubricCount ? ' Sus rúbricas se conservan.' : ''}`, confirm: 'Borrar', danger: true })) { try { await workspace.removeWorkshop(item); if (result?.id === item.id) setResult(null) } catch (err) { notify(err instanceof Error ? err.message : 'No se pudo borrar.', 'error') } }
    }} /> : <div className="builder">
      <form className="builder-form panel" onSubmit={submit} aria-label="Crear actividad">
        {target && <div className="target-chip"><span>Para <b>{target.name}</b> · <LevelPill level={target.level} hasGrades={target.hasGrades} /></span><button type="button" className="icon-btn" onClick={() => { setTarget(null); clearIntent() }} aria-label="Quitar estudiante"><X size={15} /></button></div>}

        <fieldset className="step"><legend><span className="step-n">1</span>¿Qué quieres crear?</legend>
          <KindPicker value={mode} onChange={next => { setMode(next); setError('') }} disabled={generating} />
        </fieldset>

        {mode === 'custom' ? <fieldset className="step"><legend><span className="step-n">2</span>Cuéntame cómo lo quieres</legend>
          <PromptBox value={prompt} onChange={setPrompt} topic={topic || topicIdeas[0]?.name || ''} disabled={generating} area={area} />
        </fieldset>
        : <fieldset className="step"><legend><span className="step-n">2</span>¿Sobre qué tema?</legend>
          <input value={topic} onChange={event => setTopic(event.target.value)} maxLength={120} placeholder={AREA_EXAMPLES[area].topic} autoComplete="off" aria-label="Tema" />
          {topicIdeas.length > 0 && !topic && <div className="ideas"><span>Según las notas, cuestan más:</span>{topicIdeas.map(idea => <button type="button" key={idea.id} className="chip" onClick={() => setTopic(idea.name)}>{idea.name}</button>)}</div>}
          <Field label="¿Algo más que deba tener?" optional hint={AREA_EXAMPLES[area].extra}>
            <textarea rows={2} maxLength={2000} value={extra} onChange={event => setExtra(event.target.value)} placeholder="Escribe aquí tus indicaciones para la IA" />
          </Field>
          {mode === 'workshop' && <details className="more" open={styles.some(id => id !== 'GUIDED')}>
            <summary>Tipo de trabajo: <b>{styles.map(id => ACTIVITY_STYLES.find(style => style.id === id)?.label).join(', ')}</b> <ChevronDown size={15} aria-hidden /></summary>
            <StylePicker value={styles} onChange={setStyles} disabled={generating} area={area} onArea={setArea} />
            <p className="step-hint">{isExtended(styles) ? 'Un reto por etapas: empieza en clase y se termina fuera de ella, con entregables que puedes revisar.' : 'Práctica guiada para una clase.'}</p>
          </details>}
        </fieldset>}

        <fieldset className="step"><legend><span className="step-n">3</span>¿Para qué nivel?</legend>
          <Segmented label="Nivel" value={level} onChange={setLevel} options={[
            { value: 'LOW', label: 'Refuerzo', count: summary.gradeCount ? summary.low : undefined },
            { value: 'MEDIUM', label: 'Seguimiento', count: summary.gradeCount ? summary.medium : undefined },
            { value: 'HIGH', label: 'Reto', count: summary.gradeCount ? summary.high : undefined },
          ]} />
        </fieldset>

        <fieldset className="step"><legend><span className="step-n">4</span>Material del curso <span className="optional">opcional</span></legend>
          <p className="step-hint">{selected.length ? 'Usaré el material marcado como fuente; de un libro largo tomo las páginas del tema.' : 'Sin material, lo armo con conocimiento general del tema. Marca un archivo si quieres que me base en él.'}</p>
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
            })}</ul> : null}
          <div className="step-row">
            <MaterialUploadButton courseId={course?.id ?? null} variant="ghost" onUploaded={items => { workspace.updateMaterials(list => [...items, ...list]); setSelected(items.slice(0, 6).map(item => item.id)) }}>Subir material nuevo</MaterialUploadButton>
            {selected.length > 0 && <small className="muted">{plural(selected.length, 'seleccionado', 'seleccionados')} · {fileSize(selectedSize)} de 10 MB</small>}
          </div>
          <details className="more">
            <summary>Más opciones <ChevronDown size={15} aria-hidden /></summary>
            {mode !== 'custom' && <Field label="Qué quieres que logren" optional><textarea rows={3} maxLength={1000} value={objective} onChange={event => setObjective(event.target.value)} placeholder="Ej. Que resuelvan un ciclo y expliquen cuándo termina…" /></Field>}
            <Field label="Materia" hint="Aparece en el encabezado."><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} autoComplete="off" /></Field>
          </details>
        </fieldset>

        {error && <div className="form-error" role="alert"><b>No se pudo generar.</b> {error}</div>}
        <button className="btn btn-primary btn-large" disabled={generating || (mode === 'custom' ? prompt.trim().length < MIN_PROMPT : !selected.length && !topic.trim())}>
          {generating ? <Spinner /> : <Sparkles size={18} aria-hidden />}
          {generating ? 'Creando…' : mode === 'quiz' ? 'Crear quiz' : mode === 'custom' ? 'Crear a mi medida' : `Crear taller${selected.length > 1 ? ` con ${selected.length} materiales` : ''}`}
        </button>
        <p className="privacy-note">La IA recibe {mode === 'custom' && !selected.length ? 'tus indicaciones' : 'el material'} y un resumen del curso, sin nombres ni notas individuales.</p>
      </form>

      <div className="builder-result" ref={resultRef} aria-live="polite">
        {generating ? <div className="panel generating">
          <Owl pose="think" size={132} />
          <h2>{stage}</h2>
          <p className="num">{elapsed} s · suele tardar entre 20 y 50 segundos</p>
          <div className="gen-bar" aria-hidden><span style={{ transform: `scaleX(${Math.min(95, elapsed * 1.8) / 100})` }} /></div>
          <button className="btn btn-ghost btn-small" onClick={() => abort.current?.abort()}>Cancelar</button>
        </div>
          : result ? <WorkshopView workshop={result} onCopy={async () => { try { await navigator.clipboard.writeText(workshopAsText(result)); notify('Texto copiado.') } catch { notify('No se pudo copiar.', 'error') } }} onNew={() => setResult(null)} onEdit={next => { void workspace.saveWorkshop({ ...next, id: result.id }).then(setResult).catch(err => notify(err instanceof Error ? err.message : 'No se pudo guardar el cambio.', 'error')) }} onQuiz={() => { setMode('quiz'); setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            onVariant={next => void generate({ mode: result.supportType ?? 'workshop', level: next, variantOf: result })}
            onRubric={() => navigate('rubricas', { taller: String(result.id ?? result.title) })}
            onAdjust={() => { if (result.teacherPrompt) { if (result.supportType === 'custom') setPrompt(result.teacherPrompt); else setExtra(result.teacherPrompt) } setMode(result.supportType ?? 'workshop'); setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            : error ? <div className="panel"><EmptyState icon={<RotateCw size={20} />} title="Vuelve a intentarlo" text="A veces el servicio tarda en despertar. Tu selección sigue lista." action={<button className="btn btn-secondary" onClick={() => void generate()}>Reintentar</button>} /></div>
              : <div className="panel preview"><EmptyState art="read" title="Aquí aparecerá tu actividad" text={mode === 'custom' ? 'Escribe lo que necesitas como se lo dirías a un colega: tema, cuántas actividades, cuánto tiempo y qué entregan. Yo lo armo con pistas, entregas y clave de respuestas.' : 'Con una explicación para empezar, actividades paso a paso con pistas y entregas, y preguntas con su respuesta. Podrás descargar la hoja para estudiantes y una clave solo para ti.'} /></div>}
      </div>
    </div>}
  </section>
}


