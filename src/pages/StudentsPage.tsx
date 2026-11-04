import { useMemo, useState, type FormEvent } from 'react'
import { Download, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { request, type AcademicLevel, type Student } from '../api'
import type { PageProps } from '../App'
import { ImportButton } from '../app/actions'
import { Avatar, EmptyState, Field, LevelPill, Modal, Segmented, Spinner, useFeedback } from '../components/ui'
import { downloadRoster, downloadTemplate } from '../lib/files'
import { formatGrade, levelOf, plural } from '../lib/domain'

type Filter = 'todos' | 'refuerzo' | 'seguimiento' | 'progreso' | 'sin-notas'
type Sort = 'nombre' | 'promedio'

export default function StudentsPage({ workspace, review, params }: PageProps & { params: URLSearchParams }) {
  const { course, candidates, summary, courseState } = workspace
  const { notify, confirm } = useFeedback()
  const initial = (params.get('filtro') as Filter) || 'todos'
  const [filter, setFilter] = useState<Filter>(['todos', 'refuerzo', 'seguimiento', 'progreso', 'sin-notas'].includes(initial) ? initial : 'todos')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('nombre')
  const [editing, setEditing] = useState<Student | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<number | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return candidates
      .filter(student => {
        if (filter === 'sin-notas') return !student.hasGrades
        if (filter === 'refuerzo') return student.hasGrades && student.level === 'LOW'
        if (filter === 'seguimiento') return student.hasGrades && student.level === 'MEDIUM'
        if (filter === 'progreso') return student.hasGrades && student.level === 'HIGH'
        return true
      })
      .filter(student => !q || `${student.name} ${student.email ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
      .sort((a, b) => sort === 'promedio' ? (a.hasGrades ? a.average : 99) - (b.hasGrades ? b.average : 99) : a.name.localeCompare(b.name, 'es'))
  }, [candidates, filter, query, sort])

  const trendOf = useMemo(() => new Map(workspace.trends.map(t => [t.student.id, t.direction])), [workspace.trends])

  const remove = async (student: Student) => {
    const ok = await confirm({ title: `¿Eliminar a ${student.name}?`, body: 'Esta acción no se puede deshacer.', confirm: 'Eliminar estudiante', danger: true })
    if (!ok) return
    setDeleting(student.id)
    try { await request<void>(`/api/students/${student.id}`, { method: 'DELETE' }); notify('Estudiante eliminado.'); await workspace.refreshCourse() }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error') }
    finally { setDeleting(null) }
  }

  return <section className="page">
    <header className="page-head">
      <div><h1>Estudiantes y notas</h1><p>{course?.name} · {plural(summary.students, 'estudiante', 'estudiantes')}{summary.gradeCount ? ` · ${plural(summary.gradeCount, 'nota', 'notas')}` : ''}</p></div>
      <div className="page-actions">
        <ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} />
        <ImportButton kind="grades" courseId={course?.id ?? null} onDone={workspace.refreshCourse} />
        <button className="btn btn-ghost" onClick={() => downloadRoster(candidates, course?.name ?? 'curso')} disabled={!candidates.length}><Download size={16} aria-hidden />Exportar</button>
        <button className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={16} aria-hidden />Agregar</button>
      </div>
    </header>

    <details className="help">
      <summary>¿Cómo debe ser el archivo de Excel?</summary>
      <div className="help-body">
        <p><b>Lista:</b> una columna <i>Nombre</i> (obligatoria) y, si quieres, <i>Correo</i>. <b>Notas:</b> <i>Nombre</i> o <i>Correo</i> del estudiante, <i>Materia</i>, <i>Nota</i> (de 0 a 5) y <i>Periodo</i>. Reconozco encabezados en español o inglés. El Excel se lee en tu navegador y solo se envían las filas.</p>
        <div className="help-links">
          <button className="btn btn-ghost btn-small" onClick={() => void downloadTemplate('roster', 'xlsx')}><Download size={15} aria-hidden />Plantilla de lista</button>
          <button className="btn btn-ghost btn-small" onClick={() => void downloadTemplate('grades', 'xlsx')}><Download size={15} aria-hidden />Plantilla de notas</button>
          <button className="btn btn-ghost btn-small" onClick={() => void downloadTemplate('grades', 'csv')}>Versión CSV</button>
        </div>
      </div>
    </details>

    <div className="toolbar">
      <label className="search"><Search size={16} aria-hidden /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o correo…" aria-label="Buscar estudiante" spellCheck={false} /></label>
      <Segmented label="Filtrar por estado" value={filter} onChange={setFilter} options={[
        { value: 'todos', label: 'Todos', count: summary.students },
        { value: 'refuerzo', label: 'Refuerzo', count: summary.low },
        { value: 'seguimiento', label: 'Seguimiento', count: summary.medium },
        { value: 'progreso', label: 'Buen progreso', count: summary.high },
        { value: 'sin-notas', label: 'Sin notas', count: summary.ungraded },
      ]} />
      <label className="select-inline">Ordenar<select value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="nombre">Por nombre</option><option value="promedio">Promedio más bajo primero</option></select></label>
    </div>

    <div className="table-card">
      {courseState === 'loading' ? <div className="table-skeleton" aria-label="Cargando estudiantes">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
        : visible.length ? <table className="table">
          <caption className="visually-hidden">Estudiantes de {course?.name} con su estado, promedio, notas y tendencia</caption>
          <thead><tr><th scope="col">Estudiante</th><th scope="col">Estado</th><th scope="col" className="num">Promedio</th><th scope="col" className="num">Notas</th><th scope="col">Tendencia</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>{visible.map(student => <tr key={student.id}>
            <td><button className="person-cell" onClick={() => review(student)}><Avatar name={student.name} /><span><b>{student.name}</b><small>{student.email || 'Sin correo'}</small></span></button></td>
            <td><LevelPill level={student.level} hasGrades={student.hasGrades} /></td>
            <td className="num">{student.hasGrades ? <b className={student.level === 'LOW' ? 'is-low' : ''}>{formatGrade(student.average)}</b> : <span className="muted">—</span>}</td>
            <td className="num">{student.gradeCount}</td>
            <td><TrendTag direction={trendOf.get(student.id)} /></td>
            <td><div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={() => review(student)}>Ver</button>
              <button className="icon-btn" onClick={() => setEditing(student)} aria-label={`Editar a ${student.name}`}><Pencil size={16} /></button>
              <button className="icon-btn icon-danger" onClick={() => void remove(student)} disabled={deleting === student.id} aria-label={`Eliminar a ${student.name}`}>{deleting === student.id ? <Spinner /> : <Trash2 size={16} />}</button>
            </div></td>
          </tr>)}</tbody>
        </table>
        : <EmptyState icon={<Users size={22} />} art={summary.students ? undefined : 'read'} title={summary.students ? 'Nadie coincide con la búsqueda' : 'Aún no hay estudiantes en este curso'} text={summary.students ? 'Prueba con otro nombre o cambia el filtro.' : 'Importa el Excel con la lista del grupo o agrega estudiantes uno por uno.'}
          action={summary.students ? <button className="btn btn-secondary" onClick={() => { setQuery(''); setFilter('todos') }}>Ver todos</button> : <ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} variant="primary" />} />}
      {visible.length > 0 && <footer className="table-foot">Mostrando {visible.length} de {summary.students}. El estado se calcula con el promedio de las notas cargadas.</footer>}
    </div>

    {editing !== undefined && <StudentForm student={editing} courseId={course?.id ?? null} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void workspace.refreshCourse() }} />}
  </section>
}

function StudentForm({ student, courseId, onClose, onSaved }: { student: Student | null; courseId: number | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useFeedback()
  const [name, setName] = useState(student?.name ?? '')
  const [email, setEmail] = useState(student?.email ?? '')
  const [level, setLevel] = useState<AcademicLevel>(levelOf(student?.academicLevel))
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await request<Student>(student ? `/api/students/${student.id}` : '/api/students', {
        method: student ? 'PUT' : 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, academicLevel: level, courseId }),
      })
      notify(student ? 'Cambios guardados.' : 'Estudiante agregado.')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal title={student ? 'Editar estudiante' : 'Agregar estudiante'} onClose={onClose} size="small">
    <form className="form" onSubmit={submit}>
      <Field label="Nombre completo"><input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Valentina Rojas…" autoComplete="off" /></Field>
      <Field label="Correo" optional><input type="email" maxLength={180} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@universidad.edu.co…" autoComplete="off" spellCheck={false} /></Field>
      {!student && <Field label="Nivel inicial" hint="Se reemplaza por el promedio en cuanto cargues notas.">
        <select value={level} onChange={event => setLevel(event.target.value as AcademicLevel)}><option value="LOW">Necesita refuerzo</option><option value="MEDIUM">En seguimiento</option><option value="HIGH">Buen progreso</option></select>
      </Field>}
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{saving ? 'Guardando…' : student ? 'Guardar cambios' : 'Agregar estudiante'}</button></div>
    </form>
  </Modal>
}

function TrendTag({ direction }: { direction?: 'down' | 'up' | 'flat' | 'unknown' }) {
  if (direction === 'down') return <span className="trend trend-down">↓ Baja</span>
  if (direction === 'up') return <span className="trend trend-up">↑ Sube</span>
  if (direction === 'flat') return <span className="muted">Estable</span>
  return <span className="muted">—</span>
}
