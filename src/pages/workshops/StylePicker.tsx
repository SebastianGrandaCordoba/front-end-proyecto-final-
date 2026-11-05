import { Briefcase, Code2, LayoutTemplate, ListChecks, Rocket, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { ACTIVITY_STYLES, MAX_STYLES, toggleStyle, type ActivityStyleId } from '../../lib/activityStyles'

const icons: Record<ActivityStyleId, ReactNode> = {
  GUIDED: <ListChecks size={18} aria-hidden />,
  CODE: <Code2 size={18} aria-hidden />,
  APP: <LayoutTemplate size={18} aria-hidden />,
  DEPLOY: <Rocket size={18} aria-hidden />,
  CASE: <Briefcase size={18} aria-hidden />,
  TEAM: <Users size={18} aria-hidden />,
}

/** Choose up to three kinds of work; each is a toggle button so it works with keyboard and screen readers. */
export function StylePicker({ value, onChange, disabled }: { value: ActivityStyleId[]; onChange: (next: ActivityStyleId[]) => void; disabled?: boolean }) {
  const full = value.filter(id => id !== 'GUIDED').length >= MAX_STYLES
  return <div className="style-picker" role="group" aria-label={`Tipo de trabajo, hasta ${MAX_STYLES}`}>
    <span className="style-picker-label">Tipo de trabajo <small>hasta {MAX_STYLES}</small></span>
    <div className="style-grid">
      {ACTIVITY_STYLES.map(style => {
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
