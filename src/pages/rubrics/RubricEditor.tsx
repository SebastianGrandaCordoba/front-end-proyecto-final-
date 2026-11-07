import { ArrowDown, ArrowUp, Plus, Save, Scale, Trash2 } from 'lucide-react'
import { Spinner } from '../../components/ui'
import { plainNumber } from '../../lib/gradeSheet'
import { emptyCriterion, LEVELS, weightSum, type RubricCriterion, type RubricDraft } from '../../lib/rubrics'

const MAX_CRITERIA = 10

/**
 * The rubric as a table: one row per criterion (name, what it evaluates, weight) and one column per level.
 * Everything is editable in place; saving checks that the weights add up to 100 %.
 */
export function RubricEditor({ draft, onChange, onSave, saving, dirty, levelGrades, isNew }: {
  draft: RubricDraft
  onChange: (draft: RubricDraft) => void
  onSave: () => void
  saving: boolean
  dirty: boolean
  levelGrades: number[]
  isNew: boolean
}) {
  const sum = weightSum(draft.criteria)
  const balanced = Math.abs(sum - 100) <= 0.01
  const setCriterion = (index: number, patch: Partial<RubricCriterion>) =>
    onChange({ ...draft, criteria: draft.criteria.map((c, i) => i === index ? { ...c, ...patch } : c) })
  const setLevel = (index: number, key: keyof RubricCriterion['levels'], text: string) =>
    setCriterion(index, { levels: { ...draft.criteria[index].levels, [key]: text } })
  const move = (index: number, step: -1 | 1) => {
    const next = [...draft.criteria]
    const [item] = next.splice(index, 1)
    next.splice(index + step, 0, item)
    onChange({ ...draft, criteria: next })
  }
  const spread = () => {
    const n = draft.criteria.length
    const base = Math.floor(100 / n)
    onChange({ ...draft, criteria: draft.criteria.map((c, i) => ({ ...c, weight: i === n - 1 ? 100 - base * (n - 1) : base })) })
  }
  const adjust = () => {
    if (sum <= 0) { spread(); return }
    const scaled = draft.criteria.map(c => Math.round((Number(c.weight) || 0) / sum * 100))
    scaled[scaled.length - 1] += 100 - scaled.reduce((a, b) => a + b, 0)
    onChange({ ...draft, criteria: draft.criteria.map((c, i) => ({ ...c, weight: scaled[i] })) })
  }

  return <div className="rubric-editor">
    <div className="rubric-title-row">
      <input className="rubric-title" value={draft.title} maxLength={150} onChange={event => onChange({ ...draft, title: event.target.value })} aria-label="Título de la rúbrica" />
      <textarea className="rubric-desc" rows={2} value={draft.description} maxLength={1000} placeholder="Para qué actividad es y cómo se usa (opcional)"
        onChange={event => onChange({ ...draft, description: event.target.value })} aria-label="Descripción de la rúbrica" />
    </div>

    <div className={`weight-bar is-${balanced ? 'complete' : 'off'}`}>
      <Scale size={15} aria-hidden />
      <span>{balanced ? 'Los pesos suman 100 %.' : `Los pesos suman ${plainNumber(sum)} %; deben sumar 100 %.`}</span>
      {!balanced && <div className="weight-actions"><button type="button" className="link-btn" onClick={adjust}>Ajustar a 100 %</button><button type="button" className="link-btn" onClick={spread}>Partes iguales</button></div>}
    </div>

    <div className="sheet-scroll">
      <table className="rubric-table" aria-label="Criterios y niveles">
        <thead><tr>
          <th scope="col" className="rubric-crit-col">Criterio</th>
          {LEVELS.map((level, i) => <th key={level.key} scope="col" className={`lvl-${i}`}>{level.label}<small>{plainNumber(levelGrades[i] ?? 0)}</small></th>)}
        </tr></thead>
        <tbody>{draft.criteria.map((criterion, index) => <tr key={criterion.id ?? `new-${index}`}>
          <th scope="row" className="rubric-crit-col">
            <input className="crit-name" value={criterion.name} maxLength={150} placeholder="Nombre del criterio" onChange={event => setCriterion(index, { name: event.target.value })} aria-label={`Nombre del criterio ${index + 1}`} />
            <textarea className="crit-desc" rows={2} value={criterion.description} maxLength={500} placeholder="Qué evalúa" onChange={event => setCriterion(index, { description: event.target.value })} aria-label={`Qué evalúa el criterio ${index + 1}`} />
            <div className="crit-tools">
              <label className="col-weight"><input value={criterion.weight} inputMode="decimal" maxLength={6} aria-label={`Peso del criterio ${index + 1}`}
                onChange={event => setCriterion(index, { weight: Number(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0 })} onFocus={event => event.target.select()} /><span aria-hidden>%</span></label>
              <button type="button" className="icon-btn" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir criterio"><ArrowUp size={14} /></button>
              <button type="button" className="icon-btn" disabled={index === draft.criteria.length - 1} onClick={() => move(index, 1)} aria-label="Bajar criterio"><ArrowDown size={14} /></button>
              <button type="button" className="icon-btn icon-danger" disabled={draft.criteria.length <= 1} onClick={() => onChange({ ...draft, criteria: draft.criteria.filter((_, i) => i !== index) })} aria-label="Quitar criterio"><Trash2 size={14} /></button>
            </div>
          </th>
          {LEVELS.map((level, i) => <td key={level.key} className={`lvl-${i}`}>
            <textarea rows={4} value={criterion.levels[level.key]} maxLength={1000} placeholder={`Qué se ve en un trabajo ${level.label.toLowerCase()}`}
              onChange={event => setLevel(index, level.key, event.target.value)} aria-label={`${criterion.name || `Criterio ${index + 1}`}: ${level.label}`} />
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>

    <div className="rubric-editor-foot">
      <button type="button" className="btn btn-ghost btn-small" disabled={draft.criteria.length >= MAX_CRITERIA} onClick={() => onChange({ ...draft, criteria: [...draft.criteria, emptyCriterion()] })}><Plus size={15} aria-hidden />Agregar criterio</button>
      <span className="push" />
      {dirty && <span className="muted">{isNew ? 'Borrador sin guardar' : 'Cambios sin guardar'}</span>}
      <button type="button" className="btn btn-primary" disabled={saving || !dirty || !balanced} onClick={onSave}>{saving ? <Spinner /> : <Save size={16} aria-hidden />}{isNew ? 'Guardar rúbrica' : 'Guardar cambios'}</button>
    </div>
  </div>
}
