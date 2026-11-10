import { Sparkles } from 'lucide-react'
import { AREA_EXAMPLES, type AcademicArea } from '../../lib/activityStyles'

export const MAX_PROMPT = 2000
export const MIN_PROMPT = 15

/** Starting points the teacher can tap and then edit: they show what a good request looks like. */
export function promptIdeas(topic: string, area: AcademicArea = 'general') {
  const about = topic.trim() || 'el tema de esta semana'
  return [
    { label: 'Ejercicios progresivos', text: `Un taller de 4 ejercicios sobre ${about}, de fácil a difícil. El primero con un ejemplo resuelto y el último con un caso de la vida real. Unos 50 minutos en clase, en parejas.` },
    { label: 'Actividad práctica', text: `Una actividad de 90 minutos sobre ${about} donde ${AREA_EXAMPLES[area].lab}.` },
    { label: 'Para quien faltó', text: `Una guía para estudiantes que faltaron a la clase de ${about}: explicación corta con un ejemplo, 3 ejercicios para practicar en casa y cómo saber si lo hicieron bien.` },
    { label: 'Preguntas abiertas', text: `6 preguntas abiertas sobre ${about} que pidan explicar y justificar, no memorizar. Incluye los criterios para calificar cada una sobre 5.` },
  ]
}

/** The "A tu medida" request: a roomy box, ideas to start from and a gentle length guide. */
export function PromptBox({ value, onChange, topic, disabled, area = 'general' }: { value: string; onChange: (text: string) => void; topic: string; disabled?: boolean; area?: AcademicArea }) {
  const length = value.trim().length
  return <div className="prompt-box">
    <label htmlFor="teacher-prompt" className="visually-hidden">Describe el taller que quieres</label>
    <textarea id="teacher-prompt" rows={7} maxLength={MAX_PROMPT} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
      placeholder={'Ej.: Un taller de 3 ejercicios sobre normalización hasta 3FN con la base de datos de una biblioteca. Que trabajen en parejas 60 minutos y entreguen el modelo en una imagen.'} />
    <div className="prompt-foot">
      <small className={length > 0 && length < MIN_PROMPT ? 'is-low' : 'muted'}>
        {length === 0 ? 'Di el tema, cuántas actividades, cuánto tiempo y qué deben entregar.' : length < MIN_PROMPT ? 'Cuéntame un poco más.' : `${value.length} / ${MAX_PROMPT}`}
      </small>
    </div>
    {length === 0 && <div className="prompt-ideas" aria-label="Ideas para empezar">
      <span><Sparkles size={14} aria-hidden />Empieza con una idea y ajústala:</span>
      {promptIdeas(topic, area).map(idea => <button type="button" key={idea.label} className="chip" disabled={disabled} onClick={() => onChange(idea.text)}>{idea.label}</button>)}
    </div>}
  </div>
}
