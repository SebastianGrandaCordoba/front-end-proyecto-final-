import { useEffect, useMemo, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { Spinner, useFeedback } from '../../components/ui'
import { formatGrade } from '../../lib/domain'
import type { Projection, Sim, Trend } from '../../lib/insights'

interface Props {
  students: { id: number; name: string }[]
  trends: Trend[]
  projections: Map<number, Projection>
  sim: Sim
  saveScheme: (weights: number[]) => Promise<void>
  courseName: string
}

const PASSING = 3 // on 0–5, i.e. 60 % of any scale

/**
 * The final grade sheet: one column per corte with its weight, what each student has earned so far,
 * the final grade (or where it is heading) and what is still needed to pass. The numbers come from the
 * backend projection, so they match the simulator and Búho's answers.
 */
export function FinalGrades({ students, trends, projections, sim, saveScheme, courseName }: Props) {
  const { notify } = useFeedback()
  const [weights, setWeights] = useState<number[]>(sim.weights)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setWeights(sim.weights) }, [sim.weights.join(',')])
  const periods = sim.periods.slice(0, weights.length)
  const sum = weights.reduce((a, b) => a + b, 0)
  const changed = weights.join(',') !== sim.weights.join(',')
  const byStudent = useMemo(() => new Map(trends.map(t => [t.student.id, new Map(t.points.map(p => [p.period, p.average]))])), [trends])
  const evaluated = periods.reduce((acc, period, i) => acc + (sim.observed.includes(period) ? weights[i] ?? 0 : 0), 0)

  const save = async () => {
    setSaving(true)
    try { await saveScheme(weights); notify('Pesos de los cortes guardados. La definitiva ya está recalculada.') }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudieron guardar los pesos.', 'error') }
    finally { setSaving(false) }
  }

  const exportCsv = () => {
    const header = ['Estudiante', ...periods.map((p, i) => `${p} (${weights[i]}%)`), 'Acumulado', 'Definitiva', 'Necesita en lo que falta']
    const lines = students.map(student => {
      const points = byStudent.get(student.id)
      const p = projections.get(student.id)
      return [student.name, ...periods.map(period => points?.get(period) != null ? formatGrade(points.get(period)!) : ''),
        p && p.status !== 'no-data' ? formatGrade(p.earned) : '', p && p.remainingWeight < 0.001 ? formatGrade(p.earned) : '',
        p?.needed != null ? formatGrade(p.needed) : '']
    })
    const csv = [header, ...lines].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `Definitivas - ${courseName}.csv` })
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className="final-grades">
    <div className="final-head">
      <p>La definitiva suma la nota de cada corte por su peso. Va evaluado el <b>{evaluated} %</b> del semestre; lo que falta se muestra como lo que cada estudiante necesita para llegar a <b>{formatGrade(PASSING)}</b>.</p>
      <div className="button-row">
        {changed && <button className="btn btn-primary btn-small" disabled={sum !== 100 || saving} onClick={() => void save()}>{saving ? <Spinner /> : <Save size={15} aria-hidden />}Guardar pesos</button>}
        <button className="btn btn-ghost btn-small" onClick={exportCsv}><Download size={15} aria-hidden />Exportar definitivas</button>
      </div>
    </div>
    {sum !== 100 && <p className="weight-warning" role="status">Los pesos de los cortes suman {sum} %; deben sumar 100 %.</p>}
    <div className="sheet-scroll">
      <table className="grade-sheet final-sheet" aria-label="Notas definitivas">
        <thead><tr>
          <th scope="col" className="sheet-name">Estudiante</th>
          {periods.map((period, i) => <th key={period} scope="col">
            <span>{period}</span>
            <label className="col-weight">
              <input value={weights[i] ?? 0} inputMode="numeric" aria-label={`Peso de ${period}`} maxLength={3}
                onChange={event => { const value = Math.max(0, Math.min(100, Number(event.target.value.replace(/\D/g, '')) || 0)); setWeights(list => list.map((w, j) => j === i ? value : w)) }} />
              <span aria-hidden>%</span>
            </label>
            <small>{sim.observed.includes(period) ? 'con notas' : 'por evaluar'}</small>
          </th>)}
          <th scope="col" className="sheet-avg">Acumulado<small>de {evaluated} %</small></th>
          <th scope="col" className="sheet-avg">Definitiva<small>o tendencia</small></th>
          <th scope="col" className="sheet-avg">Necesita<small>en lo que falta</small></th>
        </tr></thead>
        <tbody>{students.map(student => {
          const points = byStudent.get(student.id)
          const p = projections.get(student.id)
          const closed = p != null && p.remainingWeight < 0.001
          const outlook = p && p.status !== 'no-data' ? (closed ? p.earned : p.current) : null
          return <tr key={student.id}>
            <th scope="row" className="sheet-name"><b>{student.name}</b>{p && p.status !== 'no-data' && <small className="row-note">{p.explanation}</small>}</th>
            {periods.map(period => { const value = points?.get(period); return <td key={period} className={`num final-cell${value != null && Math.round(value * 10) < 30 ? ' is-low' : ''}`}>{value != null ? formatGrade(value) : '—'}</td> })}
            <td className="sheet-avg num">{p && p.status !== 'no-data' ? formatGrade(p.earned) : '—'}</td>
            <td className={`sheet-avg num${outlook != null && Math.round(outlook * 10) < 30 ? ' is-low' : ''}`}>{outlook != null ? <>{formatGrade(outlook)}{!closed && <small className="trend-mark"> si sigue así</small>}</> : '—'}</td>
            <td className={`sheet-avg num${p?.status === 'impossible' || p?.status === 'hard' ? ' is-low' : ''}`}>{p?.status === 'passed' ? (closed ? 'Aprobó' : 'Asegurado') : p?.status === 'impossible' ? 'No alcanza' : p?.needed != null ? formatGrade(p.needed) : '—'}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </div>
}
