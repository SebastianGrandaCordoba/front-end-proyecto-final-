import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCheck, Save } from 'lucide-react'
import { request } from '../../api'
import { Avatar, EmptyState, Spinner, useFeedback } from '../../components/ui'
import type { Candidate } from '../../lib/domain'
import { STATUSES, changed, isoDate, sessionLabel, statusLabel, statusShort, tally, type AttendanceStatus, type AttendanceSummary } from '../../lib/attendance'

type Mark = { studentId: number; status: AttendanceStatus }

/** Roll call for one session: every student starts as present, the teacher only taps the exceptions. */
export function AttendanceSheet({ courseId, students, summary, onSaved }: { courseId: number; students: Candidate[]; summary: Map<number, AttendanceSummary>; onSaved: () => void }) {
  const { notify } = useFeedback()
  const [date, setDate] = useState(isoDate())
  const [sessions, setSessions] = useState<string[]>([])
  const [saved, setSaved] = useState<Map<number, AttendanceStatus>>(new Map())
  const [marks, setMarks] = useState<Map<number, AttendanceStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const sorted = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name, 'es')), [students])

  useEffect(() => {
    let active = true
    request<string[]>(`/api/courses/${courseId}/attendance/sessions`).then(list => { if (active) setSessions(list) }).catch(() => undefined)
    return () => { active = false }
  }, [courseId, saved])

  useEffect(() => {
    let active = true
    setLoading(true)
    request<Mark[]>(`/api/courses/${courseId}/attendance?date=${date}`).then(list => {
      if (!active) return
      const stored = new Map(list.map(mark => [mark.studentId, mark.status]))
      setSaved(stored)
      // A new session starts with everybody present; the teacher marks only who is missing.
      setMarks(stored.size ? new Map(stored) : new Map(sorted.map(student => [student.id, 'PRESENT' as AttendanceStatus])))
    }).catch(error => notify(error instanceof Error ? error.message : 'No se pudo cargar la asistencia.', 'error'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courseId, date, sorted, notify])

  const counts = tally(marks)
  const dirty = changed(saved, marks)
  const isNew = saved.size === 0

  const set = (id: number, status: AttendanceStatus) => setMarks(current => new Map(current).set(id, status))
  const allPresent = () => setMarks(new Map(sorted.map(student => [student.id, 'PRESENT' as AttendanceStatus])))

  const save = async () => {
    setSaving(true)
    try {
      const body = [...marks].map(([studentId, status]) => ({ studentId, status }))
      const list = await request<Mark[]>(`/api/courses/${courseId}/attendance?date=${date}`, { method: 'PUT', body: JSON.stringify(body) })
      const stored = new Map(list.map(mark => [mark.studentId, mark.status]))
      setSaved(stored); setMarks(new Map(stored))
      notify(`Asistencia del ${sessionLabel(date)} guardada: ${counts.ABSENT} ${counts.ABSENT === 1 ? 'falta' : 'faltas'}.`)
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar la asistencia.', 'error') }
    finally { setSaving(false) }
  }

  if (!students.length) return <EmptyState icon={<CalendarDays size={22} />} title="Aún no hay estudiantes" text="Importa la lista del grupo para tomar asistencia." />

  return <div className="attendance">
    <div className="attendance-bar">
      <label className="date-field"><CalendarDays size={16} aria-hidden /><span className="visually-hidden">Fecha de la clase</span>
        <input type="date" value={date} max={isoDate()} onChange={event => event.target.value && setDate(event.target.value)} /></label>
      {sessions.length > 0 && <div className="session-chips" aria-label="Clases anteriores">
        {sessions.slice(0, 5).map(session => <button key={session} type="button" className={`chip${session === date ? ' is-on' : ''}`} onClick={() => setDate(session)}>{sessionLabel(session)}</button>)}
      </div>}
      <span className="attendance-count" aria-live="polite">{loading ? 'Cargando…' : `${counts.PRESENT + counts.LATE} asisten · ${counts.ABSENT} ${counts.ABSENT === 1 ? 'falta' : 'faltas'}`}{isNew && !loading && <em> · clase nueva</em>}</span>
      <button className="btn btn-ghost btn-small" type="button" onClick={allPresent} disabled={loading}><CheckCheck size={15} aria-hidden />Todos presentes</button>
    </div>

    <ul className="roll" aria-busy={loading}>
      {sorted.map(student => {
        const current = marks.get(student.id) ?? 'PRESENT'
        const stats = summary.get(student.id)
        return <li key={student.id} className={`roll-row is-${current.toLowerCase()}`}>
          <Avatar name={student.name} />
          <span className="roll-name"><b>{student.name}</b>
            <small>{stats ? `${stats.percent} % de asistencia · ${stats.absent} ${stats.absent === 1 ? 'falta' : 'faltas'}` : 'Sin registros aún'}{stats?.alert && <span className="roll-alert"> · falta seguido</span>}</small></span>
          <div className="roll-options" role="radiogroup" aria-label={`Asistencia de ${student.name}`}>
            {STATUSES.map(status => <button key={status} type="button" role="radio" aria-checked={current === status} title={statusLabel[status]}
              className={`roll-option opt-${status.toLowerCase()}${current === status ? ' is-on' : ''}`} onClick={() => set(student.id, status)} disabled={loading}>
              <span aria-hidden>{statusShort[status]}</span><span className="roll-option-label">{statusLabel[status]}</span></button>)}
          </div>
        </li>
      })}
    </ul>

    <div className={`save-bar${dirty || isNew ? ' is-visible' : ''}`}>
      <span>{isNew ? 'Esta clase aún no está guardada.' : 'Tienes cambios sin guardar.'}</span>
      <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving || loading}>{saving ? <Spinner /> : <Save size={16} aria-hidden />}Guardar asistencia</button>
    </div>
  </div>
}
