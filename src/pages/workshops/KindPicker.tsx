import { ClipboardList, ListChecks, PenLine } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SupportMode } from '../../app/types'

const KINDS: { id: SupportMode; title: string; detail: string; icon: ReactNode }[] = [
  { id: 'workshop', title: 'Taller', detail: 'Actividades paso a paso, con pistas y entregables.', icon: <ClipboardList size={20} aria-hidden /> },
  { id: 'quiz', title: 'Quiz', detail: 'De 5 a 8 preguntas con su clave de respuestas.', icon: <ListChecks size={20} aria-hidden /> },
  { id: 'custom', title: 'A tu medida', detail: 'Escribe lo que necesitas y lo armo así.', icon: <PenLine size={20} aria-hidden /> },
]

/** The first decision, as three big choices instead of a toggle with fine print. */
export function KindPicker({ value, onChange, disabled }: { value: SupportMode; onChange: (mode: SupportMode) => void; disabled?: boolean }) {
  return <div className="kind-picker" role="radiogroup" aria-label="Qué quieres crear">
    {KINDS.map(kind => <button key={kind.id} type="button" role="radio" aria-checked={value === kind.id} disabled={disabled}
      className={`kind-card kind-${kind.id}${value === kind.id ? ' is-on' : ''}`} onClick={() => onChange(kind.id)}>
      <span className="kind-icon">{kind.icon}</span>
      <b>{kind.title}</b>
      <small>{kind.detail}</small>
    </button>)}
  </div>
}
