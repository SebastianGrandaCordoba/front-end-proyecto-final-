import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { COMMON_SCALES, passingFor, plainNumber } from '../../lib/gradeSheet'

/**
 * The course scale: most Colombian universities grade over 5, many schools over 10 and some
 * programs over 100. Changing it does not change any grade, only how it is written.
 */
export function ScalePicker({ max, disabled, onChange }: { max: number; disabled?: boolean; onChange: (max: number) => void }) {
  const common = (COMMON_SCALES as readonly number[]).includes(max)
  const [custom, setCustom] = useState(!common)
  const [text, setText] = useState(common ? '' : plainNumber(max))

  const submitCustom = () => {
    const value = Number(text.replace(',', '.'))
    if (Number.isFinite(value) && value >= 1 && value <= 1000 && value !== max) onChange(Math.round(value * 100) / 100)
  }

  return <div className="scale-picker" title={`Aprueba con ${plainNumber(passingFor(max))} (60 % de la nota máxima)`}>
    <Ruler size={15} aria-hidden />
    <label htmlFor="scale-select">Escala</label>
    {custom
      ? <form onSubmit={event => { event.preventDefault(); submitCustom() }} className="scale-custom">
          <span>0 –</span>
          <input id="scale-select" value={text} onChange={event => setText(event.target.value)} onBlur={submitCustom} inputMode="decimal" aria-label="Nota máxima" autoFocus disabled={disabled} />
          <button type="button" className="link-btn" onClick={() => { setCustom(false); setText('') }}>usual</button>
        </form>
      : <select id="scale-select" value={String(max)} disabled={disabled}
          onChange={event => { if (event.target.value === 'otra') setCustom(true); else onChange(Number(event.target.value)) }}>
          {COMMON_SCALES.map(value => <option key={value} value={value}>0 – {value}</option>)}
          <option value="otra">Otra…</option>
        </select>}
  </div>
}
