import { useEffect, useMemo, useState } from 'react'
import type { PageProps } from '../../App'
import { Avatar, EmptyState, useFeedback } from '../../components/ui'
import { formatGrade, plural, type Candidate } from '../../lib/domain'
import type { Projection } from '../../lib/insights'

const statusLabel: Record<Projection['status'], string> = { passed: 'Asegurado', possible: 'Alcanzable', hard: 'Exigente', impossible: 'No alcanza', 'no-data': 'Sin notas' }
const statusTone: Record<Projection['status'], string> = { passed: 'high', possible: 'high', hard: 'medium', impossible: 'low', 'no-data': 'none' }

export function Simulator({ workspace, review }: { workspace: PageProps['workspace']; review: (s: Candidate) => void }) {
  const { sim, saveScheme, projections } = workspace
  const { notify } = useFeedback()
  const [whatIf, setWhatIf] = useState(3)
  const [onlyRisk, setOnlyRisk] = useState(false)
  const [draft, setDraft] = useState<number[]>(sim.weights)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(sim.weights) }, [sim.weights.join(',')])
  const sum = draft.reduce((s, w) => s + w, 0)
  const periods = [...sim.observed, ...Array.from({ length: Math.max(0, draft.length - sim.observed.length) }, (_, i) => `Corte ${sim.observed.length + i + 1}`)]
  // The backend stores the scheme and recalculates every projection; save once the weights add up to 100.
  useEffect(() => {
    if (sum !== 100 || draft.join(',') === sim.weights.join(',')) return
    const timer = window.setTimeout(() => {
      setSaving(true)
      saveScheme(draft).catch(error => notify(error instanceof Error ? error.message : 'No se pudo guardar el esquema.', 'error')).finally(() => setSaving(false))
    }, 600)
    return () => window.clearTimeout(timer)
  }, [draft.join(','), sum])
  const rows = useMemo(() => [...projections.values()]
    .filter(p => !onlyRisk || p.status === 'hard' || p.status === 'impossible')
    .sort((a, b) => (b.needed ?? -1) - (a.needed ?? -1)), [projections, onlyRisk])
  const setTotal = (total: number) => setDraft(total === 3 ? [30, 30, 40] : total === 2 ? [50, 50] : [25, 25, 25, 25])
  const setWeight = (index: number, value: number) => setDraft(current => current.map((w, i) => i === index ? value : w))
  const finalWith = (p: Projection) => p.earned + whatIf * p.remainingWeight
  const counts = { hard: [...projections.values()].filter(p => p.status === 'hard').length, impossible: [...projections.values()].filter(p => p.status === 'impossible').length }

  return <>
    <div className="sim-config panel">
      <div className="sim-block"><span className="field-label">Esquemas comunes</span>
        <div className="presets">{[[30, 30, 40], [20, 30, 50], [33, 33, 34], [50, 50]].map(preset => <button key={preset.join('-')} type="button" className={`chip${draft.join(',') === preset.join(',') ? ' is-on' : ''}`} disabled={preset.length < sim.observed.length} onClick={() => setDraft(preset)}>{preset.join(' / ')}</button>)}</div>
      </div>
      <div className="sim-block"><span className="field-label">Cortes del semestre</span>
        <div className="size-picker" role="radiogroup" aria-label="Número de cortes">{[2, 3, 4].map(n => <button key={n} type="button" role="radio" aria-checked={draft.length === n} className={draft.length === n ? 'is-on' : ''} disabled={n < sim.observed.length} onClick={() => setTotal(n)}>{n}</button>)}</div>
      </div>
      <div className="sim-block"><span className="field-label">Peso de cada corte {sum !== 100 ? <span className="is-low">· suman {sum}%, deben sumar 100%</span> : saving ? <span className="muted">· guardando…</span> : sim.custom ? <span className="muted">· guardado en el curso</span> : null}</span>
        <div className="weights">{periods.map((period, i) => <label key={period} className="weight"><small>{period}{i >= sim.observed.length ? ' (falta)' : ''}</small><span><input type="number" min={0} max={100} value={draft[i] ?? 0} onChange={event => setWeight(i, Math.max(0, Math.min(100, Number(event.target.value) || 0)))} inputMode="numeric" />%</span></label>)}</div>
      </div>
      <div className="sim-block"><label className="field-label" htmlFor="whatif">¿Y si todos sacan <b className="num">{formatGrade(whatIf)}</b> en lo que falta?</label>
        <input id="whatif" type="range" min={0} max={5} step={0.1} value={whatIf} onChange={event => setWhatIf(Number(event.target.value))} className="range" />
      </div>
    </div>
    <p className="explainer">{[counts.impossible ? `${plural(counts.impossible, 'estudiante ya no alcanza', 'estudiantes ya no alcanzan')} el ${formatGrade(3)}.` : '', counts.hard ? `${plural(counts.hard, 'estudiante necesita', 'estudiantes necesitan')} más de ${formatGrade(3.5)} en lo que falta.` : '', !counts.impossible && !counts.hard ? `Con las notas actuales, todos pueden aprobar sin necesitar más de ${formatGrade(3.5)} en lo que falta.` : ''].filter(Boolean).join(' ')} Para aprobar se necesita {formatGrade(3)}.</p>
    <label className="toggle"><input type="checkbox" checked={onlyRisk} onChange={event => setOnlyRisk(event.target.checked)} /> Ver solo estudiantes en riesgo</label>
    <div className="table-card"><table className="table">
      <caption className="visually-hidden">Nota necesaria para aprobar y nota final simulada de cada estudiante</caption>
      <thead><tr><th scope="col">Estudiante</th><th scope="col" className="num">Va en</th><th scope="col" className="num">Necesita</th><th scope="col">Estado</th><th scope="col" className="num">Final si saca {formatGrade(whatIf)}</th></tr></thead>
      <tbody>{rows.map(p => { const final = finalWith(p); return <tr key={p.student.id}>
        <td><button className="person-cell" onClick={() => review(p.student)}><Avatar name={p.student.name} /><span><b>{p.student.name}</b><small>{p.explanation}</small></span></button></td>
        <td className="num">{p.status === 'no-data' ? '—' : formatGrade(p.current)}</td>
        <td className="num"><b className={p.status === 'impossible' || p.status === 'hard' ? 'is-low' : ''}>{p.needed == null ? '—' : formatGrade(p.needed)}</b></td>
        <td><span className={`pill pill-${statusTone[p.status]}`}>{statusLabel[p.status]}</span></td>
        <td className={`num${Math.round(final * 10) < 30 ? ' is-low' : ''}`}>{p.status === 'no-data' ? '—' : <>{formatGrade(final)}{Math.round(final * 10) >= 30 && p.status !== 'passed' && <span className="whatif-pass" title="Con esa nota aprobaría"> ✓</span>}</>}</td>
      </tr> })}</tbody>
    </table>{!rows.length && <EmptyState art="celebrate" title="Nadie en riesgo" text="Con las notas actuales todos pueden aprobar cómodamente." />}</div>
  </>
}
