import { formatGrade } from '../../lib/domain'

export function CourseStats({ data }: { data: { students: number; average: number | null; low: number; fallingBehind: number; weakestSubject: string | null } }) {
  return <dl className="course-stats">
    <div><dt>Estudiantes</dt><dd className="num">{data.students}</dd></div>
    <div><dt>Promedio</dt><dd className="num">{data.average == null ? '—' : formatGrade(data.average)}</dd></div>
    <div className={data.low ? 'is-alert' : ''}><dt>Refuerzo</dt><dd className="num">{data.low}</dd></div>
    {data.weakestSubject && <p className="course-weakest">Tema más bajo: <b>{data.weakestSubject}</b>{data.fallingBehind ? ` · ${data.fallingBehind} vienen bajando` : ''}</p>}
  </dl>
}
