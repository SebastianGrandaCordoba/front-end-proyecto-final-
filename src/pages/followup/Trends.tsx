import { MessageSquareText } from 'lucide-react'
import type { PageProps } from '../../App'
import { Avatar, EmptyState } from '../../components/ui'
import { formatGrade, type Candidate } from '../../lib/domain'

export function Trends({ workspace, review, message }: { workspace: PageProps['workspace']; review: (s: Candidate) => void; message: (s: Candidate) => void }) {
  const { trends, sim } = workspace
  const periods = sim.observed
  if (periods.length < 2) return <div className="panel"><EmptyState title="Necesito dos cortes o más" text={`Por ahora hay notas de ${periods.length ? `un solo periodo (${periods[0]})` : 'ningún periodo'}. Cuando cargues el siguiente corte verás quién sube y quién baja.`} /></div>
  const riskLabel = (risk: number) => risk >= 60 ? 'Alto' : risk >= 35 ? 'Medio' : 'Bajo'
  return <>
    <p className="explainer">El riesgo combina el promedio con la tendencia entre {periods[0]} y {periods[periods.length - 1]}. Una caída de 0,3 o más se marca como “baja”.</p>
    <div className="table-card"><table className="table">
      <caption className="visually-hidden">Promedio de cada estudiante por corte, cambio y riesgo</caption>
      <thead><tr><th scope="col">Estudiante</th>{periods.map(p => <th key={p} scope="col" className="num">{p}</th>)}<th scope="col" className="num">Cambio</th><th scope="col">Riesgo</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
      <tbody>{trends.filter(t => t.student.hasGrades).map(t => <tr key={t.student.id}>
        <td><button className="person-cell" onClick={() => review(t.student)}><Avatar name={t.student.name} /><span><b>{t.student.name}</b><small>{t.weakest ? `Le cuesta ${t.weakest.name}` : ''}</small></span></button></td>
        {periods.map(p => { const point = t.points.find(x => x.period === p); return <td key={p} className="num">{point ? formatGrade(point.average) : <span className="muted">—</span>}</td> })}
        <td className={`num delta-${t.direction}`}>{t.delta == null ? '—' : `${t.delta > 0 ? '+' : t.delta < 0 ? '−' : ''}${formatGrade(Math.abs(t.delta))}`}</td>
        <td><span className="risk"><span className="risk-track"><i className={`risk-${riskLabel(t.risk).toLowerCase()}`} style={{ width: `${t.risk}%` }} /></span>{riskLabel(t.risk)}</span></td>
        <td><div className="row-actions"><button className="icon-btn" onClick={() => message(t.student)} aria-label={`Escribirle a ${t.student.name}`} title="Escribirle"><MessageSquareText size={16} /></button></div></td>
      </tr>)}</tbody>
    </table></div>
  </>
}
