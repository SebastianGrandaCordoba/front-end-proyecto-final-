import { useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { request, type Student } from '../api'
import type { PageProps } from '../App'
import { ImportButton } from '../app/actions'
import { Avatar, EmptyState, LevelPill, Segmented, Spinner, useFeedback } from '../components/ui'
import { downloadRoster, downloadTemplate } from '../lib/files'
import { formatGrade, plural } from '../lib/domain'
import { StudentForm } from './students/StudentForm'
import { TrendTag } from './students/TrendTag'
import { AttendanceSheet } from './students/AttendanceSheet'
import { GradeEditor } from './students/GradeEditor'
import { QuickAdd } from './students/QuickAdd'
import { useAttendanceSummary } from '../app/useAttendanceSummary'

type Filter = 'todos' | 'refuerzo' | 'seguimiento' | 'progreso' | 'sin-notas'
type Sort = 'nombre' | 'promedio'

export default function StudentsPage({ workspace, review, params, navigate, startWorkshop }: PageProps & { params: URLSearchParams }) {
  const { course, candidates, summary, courseState } = workspace
  const { notify, confirm } = useFeedback()
  const initial = (params.get('filtro') as Filter) || 'todos'
  const [filter, setFilter] = useState<Filter>(['todos', 'refuerzo', 'seguimiento', 'progreso', 'sin-notas'].includes(initial) ? initial : 'todos')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('nombre')
  const [editing, setEditing] = useState<Student | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<number | null>(null)
  type View = 'lista' | 'notas' | 'asistencia'
  const viewFrom = (value: string | null): View => value === 'asistencia' || value === 'notas' ? value : 'lista'
  const [view, setView] = useState<View>(viewFrom(params.get('vista')))
  useEffect(() => { if (params.get('vista')) setView(viewFrom(params.get('vista'))) }, [params])
  const [quickAdd, setQuickAdd] = useState(false)
  const attendance = useAttendanceSummary(course?.id ?? null)
  const absentees = [...attendance.summary.values()].filter(row => row.alert).length

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
      <div className="tabs" role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={view === 'lista'} className={view === 'lista' ? 'is-on' : ''} onClick={() => setView('lista')}>Lista</button>
        <button role="tab" aria-selected={view === 'notas'} className={view === 'notas' ? 'is-on' : ''} onClick={() => setView('notas')}>Notas</button>
        <button role="tab" aria-selected={view === 'asistencia'} className={view === 'asistencia' ? 'is-on' : ''} onClick={() => setView('asistencia')}>Asistencia{absentees > 0 && <span className="seg-count seg-alert">{absentees}</span>}</button>
      </div>
      {view === 'lista' && <div className="page-actions">
        <ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} />
        <ImportButton kind="grades" courseId={course?.id ?? null} onDone={workspace.refreshCourse} />
        <button className="btn btn-ghost" onClick={() => downloadRoster(candidates, course?.name ?? 'curso')} disabled={!candidates.length}><Download size={16} aria-hidden />Exportar</button>
        <button className="btn btn-primary" onClick={() => setQuickAdd(true)}><UserPlus size={16} aria-hidden />Agregar estudiantes</button>
      </div>}
    </header>

    {view === 'notas' && course ? <GradeEditor courseId={course.id} courseName={course.name} onSaved={() => void workspace.refreshCourse()} onScaleChanged={() => void workspace.loadCourses().then(workspace.refreshCourse)} onQuickAdd={() => setQuickAdd(true)}
      trends={workspace.trends} projections={workspace.projections} sim={workspace.sim} saveScheme={workspace.saveScheme} navigate={navigate} startWorkshop={startWorkshop} />
    : view === 'asistencia' && course ? <AttendanceSheet courseId={course.id} students={candidates} summary={attendance.summary} onSaved={() => void attendance.reload()} /> : <>

    <details className="help">
      <summary>¿Cómo debe ser el archivo de Excel?</summary>
      <div className="help-body">
        <p><b>Lista:</b> una columna <i>Nombre completo</i> y, si quieres, <i>Correo</i>. <b>Notas:</b> una hoja por corte, con los estudiantes en filas y un tema por columna; el nombre de la hoja es el corte. Notas de 0 a 5 con coma o punto. Las plantillas traen instrucciones y marcan en rojo lo que está bajo 3,0. También acepto el formato de una nota por fila. El Excel se lee en tu navegador y solo se envían los datos.</p>
        <p>¿Prefieres no usar Excel? Agrega estudiantes con <b>Agregar estudiantes</b> y escribe las notas en la pestaña <b>Notas</b>.</p>
        <div className="help-links">
          <button className="btn btn-ghost btn-small" onClick={() => void downloadTemplate('roster', 'xlsx')}><Download size={15} aria-hidden />Plantilla de lista</button>
          <button className="btn btn-ghost btn-small" onClick={() => void downloadTemplate('grades', 'xlsx')}><Download size={15} aria-hidden />Plantilla de notas</button>
          {course && summary.students > 0 && <button className="btn btn-ghost btn-small" onClick={() => void import('../lib/templates').then(t => t.downloadCourseGradeWorkbook(course.id, course.name))}><Download size={15} aria-hidden />Notas de este curso en Excel</button>}
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
          <thead><tr><th scope="col">Estudiante</th><th scope="col">Estado</th><th scope="col" className="num">Promedio</th><th scope="col" className="num">Notas</th><th scope="col">Tendencia</th>{attendance.summary.size > 0 && <th scope="col" className="num">Asistencia</th>}<th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>{visible.map(student => <tr key={student.id}>
            <td><button className="person-cell" onClick={() => review(student)}><Avatar name={student.name} /><span><b>{student.name}</b><small>{student.email || 'Sin correo'}</small></span></button></td>
            <td><LevelPill level={student.level} hasGrades={student.hasGrades} /></td>
            <td className="num">{student.hasGrades ? <b className={student.level === 'LOW' ? 'is-low' : ''}>{formatGrade(student.average)}</b> : <span className="muted">—</span>}</td>
            <td className="num">{student.gradeCount}</td>
            <td><TrendTag direction={trendOf.get(student.id)} /></td>
            {attendance.summary.size > 0 && <td className="num">{attendance.summary.get(student.id) ? <span className={attendance.summary.get(student.id)!.alert ? 'is-low' : ''}>{attendance.summary.get(student.id)!.percent} %</span> : <span className="muted">—</span>}</td>}
            <td><div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={() => review(student)}>Ver</button>
              <button className="icon-btn" onClick={() => setEditing(student)} aria-label={`Editar a ${student.name}`}><Pencil size={16} /></button>
              <button className="icon-btn icon-danger" onClick={() => void remove(student)} disabled={deleting === student.id} aria-label={`Eliminar a ${student.name}`}>{deleting === student.id ? <Spinner /> : <Trash2 size={16} />}</button>
            </div></td>
          </tr>)}</tbody>
        </table>
        : <EmptyState icon={<Users size={22} />} art={summary.students ? undefined : 'read'} title={summary.students ? 'Nadie coincide con la búsqueda' : 'Aún no hay estudiantes en este curso'} text={summary.students ? 'Prueba con otro nombre o cambia el filtro.' : 'Importa el Excel con la lista del grupo o agrega estudiantes uno por uno.'}
          action={summary.students ? <button className="btn btn-secondary" onClick={() => { setQuery(''); setFilter('todos') }}>Ver todos</button> : <div className="button-row"><button className="btn btn-primary" onClick={() => setQuickAdd(true)}><UserPlus size={16} aria-hidden />Agregar estudiantes</button><ImportButton kind="roster" courseId={course?.id ?? null} onDone={workspace.refreshCourse} /></div>} />}
      {visible.length > 0 && <footer className="table-foot">Mostrando {visible.length} de {summary.students}. El estado se calcula con el promedio de las notas cargadas.</footer>}
    </div>
    </>}

    {quickAdd && course && <QuickAdd courseId={course.id} courseName={course.name} onClose={() => setQuickAdd(false)} onAdded={() => void workspace.refreshCourse()} />}
    {editing !== undefined && <StudentForm student={editing} courseId={course?.id ?? null} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void workspace.refreshCourse() }} />}
  </section>
}


