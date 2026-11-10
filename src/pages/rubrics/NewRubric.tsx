import { useState, type FormEvent } from 'react'
import { ArrowLeft, FileCheck2, FilePlus2, Sparkles } from 'lucide-react'
import type { GeneratedWorkshop } from '../../api'
import { Field, Segmented, Spinner } from '../../components/ui'
import { blankRubric, rubricApi, type RubricDraft } from '../../lib/rubrics'

/**
 * First step of a rubric: describe the activity (or pick a saved workshop) and let the AI write a draft,
 * or start from a plain template. Nothing is saved until the teacher reviews it.
 */
export function NewRubric({ courseId, workshops, initialWorkshop, onDraft, onBack }: {
  courseId: number
  workshops: GeneratedWorkshop[]
  initialWorkshop?: GeneratedWorkshop | null
  onDraft: (draft: RubricDraft) => void
  onBack: () => void
}) {
  const usable = workshops.filter(w => w.id)
  const [source, setSource] = useState<number | null>(initialWorkshop?.id ?? null)
  const [activity, setActivity] = useState('')
  const [count, setCount] = useState<'3' | '4' | '5' | '6'>('4')
  const [extra, setExtra] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const chosen = usable.find(w => w.id === source) ?? null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!chosen && activity.trim().length < 15) { setError('Elige un taller o describe la actividad en al menos una frase: qué hacen y qué entregan.'); return }
    setWorking(true); setError('')
    try {
      // With a saved workshop the server reads its full content, so the criteria follow its activities.
      const draft = await rubricApi.generate(courseId, { activity: activity.trim(), criteriaCount: Number(count), teacherPrompt: extra.trim() || undefined, activityId: chosen?.id })
      onDraft(draft)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear la rúbrica.') }
    finally { setWorking(false) }
  }

  return <form className="panel rubric-new" onSubmit={submit} aria-label="Nueva rúbrica">
    <button type="button" className="link-btn back-link" onClick={onBack}><ArrowLeft size={15} aria-hidden />Rúbricas</button>
    <div className="rubric-new-head">
      <h2>¿Qué vas a calificar?</h2>
      <p>Cuéntame la actividad y armo los criterios con cuatro niveles descritos. Luego la ajustas a tu gusto.</p>
    </div>

    {usable.length > 0 && <Field label="¿Qué actividad vas a evaluar?" hint="La IA lee el taller completo: sus actividades, entregas y preguntas.">
      <select value={source ?? ''} onChange={event => setSource(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Otra actividad (la describo yo)</option>
        {usable.map(w => <option key={w.id} value={w.id}>{w.title}{w.topic ? ` · ${w.topic}` : ''}</option>)}
      </select>
    </Field>}
    {chosen && <div className="attached-activity"><FileCheck2 size={18} aria-hidden /><div><b>{chosen.title}</b><small>{chosen.activities.length} actividades · {chosen.assessment.length} preguntas{chosen.topic ? ` · ${chosen.topic}` : ''}</small></div></div>}

    <Field label={chosen ? 'Algo que deba saber de la entrega' : 'La actividad'} optional={!!chosen} hint={chosen ? 'Ej.: el punto 3 vale más; lo entregan en parejas.' : 'Qué hacen los estudiantes y qué entregan. Mientras más concreto, mejores criterios.'}>
      <textarea rows={chosen ? 3 : 7} maxLength={6000} value={activity} onChange={event => setActivity(event.target.value)}
        placeholder={chosen ? 'Opcional' : 'Ej.: Tarea con tres puntos; el tercero es el más complejo. Cada punto tiene cinco literales salvo el último, que tiene ocho.'} />
    </Field>

    <div className="rubric-new-row">
      <div className="field"><span className="field-label">Criterios</span>
        <Segmented label="Cantidad de criterios" value={count} onChange={setCount} options={[{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }, { value: '6', label: '6' }]} />
      </div>
      <Field label="¿Algo que deba evaluar sí o sí?" optional>
        <input value={extra} onChange={event => setExtra(event.target.value)} maxLength={2000} placeholder="Ej.: trabajo en equipo, ortografía, uso de Git" />
      </Field>
    </div>

    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="button-row">
      <button className="btn btn-primary" disabled={working}>{working ? <Spinner /> : <Sparkles size={16} aria-hidden />}{working ? 'Escribiendo criterios…' : 'Crear con IA'}</button>
      <button type="button" className="btn btn-ghost" disabled={working} onClick={() => onDraft({ ...blankRubric(chosen ? `Rúbrica: ${chosen.title}` : 'Nueva rúbrica'), activityId: chosen?.id ?? null })}><FilePlus2 size={16} aria-hidden />Empezar con una plantilla</button>
    </div>
  </form>
}
