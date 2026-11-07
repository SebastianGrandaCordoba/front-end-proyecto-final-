import { useState, type FormEvent } from 'react'
import { ArrowLeft, FilePlus2, Sparkles } from 'lucide-react'
import type { GeneratedWorkshop } from '../../api'
import { Field, Segmented, Spinner } from '../../components/ui'
import { activityFromWorkshop, blankRubric, rubricApi, type RubricDraft } from '../../lib/rubrics'

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
  const usable = workshops.filter(w => w.supportType !== 'quiz')
  const [source, setSource] = useState<string>(initialWorkshop?.title ?? '')
  const [activity, setActivity] = useState(initialWorkshop ? activityFromWorkshop(initialWorkshop) : '')
  const [count, setCount] = useState<'3' | '4' | '5' | '6'>('4')
  const [extra, setExtra] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const pick = (title: string) => {
    setSource(title)
    const workshop = usable.find(w => w.title === title)
    setActivity(workshop ? activityFromWorkshop(workshop) : '')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (activity.trim().length < 15) { setError('Describe la actividad en al menos una frase: qué hacen y qué entregan.'); return }
    setWorking(true); setError('')
    try {
      const draft = await rubricApi.generate(courseId, { activity: activity.trim(), criteriaCount: Number(count), teacherPrompt: extra.trim() || undefined })
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

    {usable.length > 0 && <Field label="Partir de un taller guardado" optional>
      <select value={source} onChange={event => pick(event.target.value)}>
        <option value="">Escribirla yo</option>
        {usable.map(w => <option key={w.title} value={w.title}>{w.title}</option>)}
      </select>
    </Field>}

    <Field label="La actividad" hint="Qué hacen los estudiantes y qué entregan. Mientras más concreto, mejores criterios.">
      <textarea rows={7} maxLength={6000} value={activity} onChange={event => { setActivity(event.target.value); setSource('') }}
        placeholder="Ej.: En parejas implementan el patrón Observer en Java para una app de notificaciones, con pruebas unitarias, un diagrama de clases y un video de 3 minutos explicando el diseño." />
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
      <button type="button" className="btn btn-ghost" disabled={working} onClick={() => onDraft(blankRubric(source || 'Nueva rúbrica'))}><FilePlus2 size={16} aria-hidden />Empezar con una plantilla</button>
    </div>
  </form>
}
