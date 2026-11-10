import { BookOpenText, Briefcase, Calculator, Code2, FlaskConical, LayoutTemplate, ListChecks, MessagesSquare, PenLine, Rocket, ScrollText, Scale, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { AREA_LABEL, MAX_STYLES, stylesFor, toggleStyle, type AcademicArea, type ActivityStyleId } from '../../lib/activityStyles'

const icons: Record<ActivityStyleId, ReactNode> = {
  GUIDED: <ListChecks size={18} aria-hidden />,
  PROBLEMS: <Calculator size={18} aria-hidden />,
  LAB: <FlaskConical size={18} aria-hidden />,
  SOURCES: <ScrollText size={18} aria-hidden />,
  ESSAY: <Scale size={18} aria-hidden />,
  READING: <BookOpenText size={18} aria-hidden />,
  WRITING: <PenLine size={18} aria-hidden />,
  ORAL: <MessagesSquare size={18} aria-hidden />,
  CODE: <Code2 size={18} aria-hidden />,
  APP: <LayoutTemplate size={18} aria-hidden />,
  DEPLOY: <Rocket size={18} aria-hidden />,
  CASE: <Briefcase size={18} aria-hidden />,
  TEAM: <Users size={18} aria-hidden />,
}

/** Choose up to three kinds of work; each is a toggle button so it works with keyboard and screen readers. */
export function StylePicker({ value, onChange, disabled, area, onArea }: { value: ActivityStyleId[]; onChange: (next: ActivityStyleId[]) => void; disabled?: boolean; area: AcademicArea; onArea: (area: AcademicArea) => void }) {
  const full = value.filter(id => id !== 'GUIDED').length >= MAX_STYLES
  return <div className="style-picker" role="group" aria-label={`Tipo de trabajo, hasta ${MAX_STYLES}`}>
    <div className="style-picker-head">
      <span className="style-picker-label">Tipo de trabajo <small>hasta {MAX_STYLES}</small></span>
      <label className="area-picker">Área
        <select value={area} onChange={event => onArea(event.target.value as AcademicArea)} disabled={disabled}>
          {(Object.keys(AREA_LABEL) as AcademicArea[]).map(key => <option key={key} value={key}>{AREA_LABEL[key]}</option>)}
        </select>
      </label>
    </div>
    <div className="style-grid">
      {stylesFor(area).map(style => {
        const on = value.includes(style.id)
        return <button key={style.id} type="button" className={`style-card${on ? ' is-on' : ''}`} aria-pressed={on}
          disabled={disabled || (!on && full && style.id !== 'GUIDED')} onClick={() => onChange(toggleStyle(value, style.id))}>
          <span className="style-icon">{icons[style.id]}</span>
          <span className="style-text"><b>{style.label}</b><small>{style.detail}</small></span>
        </button>
      })}
    </div>
  </div>
}
