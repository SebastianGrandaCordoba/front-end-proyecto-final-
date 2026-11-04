import { useEffect, useState, type FormEvent } from 'react'
import { formatGrade } from '../lib/domain'
import { ArrowRight, FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { request, type Course } from '../api'
import type { PageProps } from '../App'
import { EmptyState, Field, Modal, Spinner, useFeedback } from '../components/ui'

export default function CoursesPage({ workspace, navigate, params }: PageProps & { params: URLSearchParams }) {
  const { courses, course: active, setCourseId, setCourses } = workspace
  const { notify, confirm } = useFeedback()
  const [creating, setCreating] = useState(params.get('nuevo') === '1')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)
  useEffect(() => { if (params.get('nuevo') === '1') setCreating(true) }, [params])
  // One summary per course, computed by the backend (TeacherOverviewUseCase).
  type Overview = { courseId: number; students: number; average: number | null; low: number; fallingBehind: number; ungraded: number; weakestSubject: string | null }
  const [overview, setOverview] = useState<Map<number, Overview>>(new Map())
  useEffect(() => {
    let active = true
    request<Overview[]>('/api/insights/overview').then(rows => { if (active) setOverview(new Map(rows.map(r => [r.courseId, r]))) }).catch(() => undefined)
    return () => { active = false }
  }, [courses.length])

  const remove = async (course: Course) => {
    const ok = await confirm({ title: `¿Eliminar “${course.name}”?`, body: 'Solo se puede eliminar un curso vacío, sin estudiantes ni notas.', confirm: 'Eliminar curso', danger: true })
    if (!ok) return
    setDeleting(course.id)
    try {
      await request<void>(`/api/courses/${course.id}`, { method: 'DELETE' })
      const rest = courses.filter(item => item.id !== course.id)
      setCourses(rest)
      if (active?.id === course.id) setCourseId(rest[0]?.id ?? null)
      notify('Curso eliminado.')
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar el curso.', 'error') }
    finally { setDeleting(null) }
  }

  return <section className="page">
    <header className="page-head">
      <div><h1>Mis cursos</h1><p>Cada curso guarda por separado su lista, sus notas, su material y sus talleres.</p></div>
      <div className="page-actions"><button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear curso</button></div>
    </header>

    {courses.length ? <ul className="courses">{courses.map(course => <li key={course.id} className={`panel course${active?.id === course.id ? ' is-active' : ''}`}>
      <div className="course-top"><FolderOpen size={18} aria-hidden /><span className="muted">{course.period || 'Sin periodo'}</span>{active?.id === course.id && <span className="pill pill-active">Abierto</span>}
        <button className="icon-btn push" onClick={() => setEditing(course)} aria-label={`Editar ${course.name}`}><Pencil size={16} /></button>
        <button className="icon-btn icon-danger" onClick={() => void remove(course)} disabled={deleting === course.id} aria-label={`Eliminar ${course.name}`}>{deleting === course.id ? <Spinner /> : <Trash2 size={16} />}</button></div>
      <h2>{course.name}</h2>
      <p>{course.description || 'Sin descripción.'}</p>
      {overview.get(course.id) && <CourseStats data={overview.get(course.id)!} />}
      <button className="btn btn-secondary" onClick={() => { setCourseId(course.id); navigate('inicio') }}>{active?.id === course.id ? 'Ir al inicio' : 'Abrir curso'}<ArrowRight size={16} aria-hidden /></button>
    </li>)}</ul> : <div className="panel"><EmptyState art="wave" title="Crea tu primer curso" text="Por ejemplo: “Programación I · Grupo A”. Después cargas la lista y las notas." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear curso</button>} /></div>}

    {editing && <CourseForm course={editing} onClose={() => setEditing(null)} onCreated={saved => { setCourses(courses.map(c => c.id === saved.id ? saved : c)); setEditing(null); notify('Curso actualizado.') }} />}
    {creating && <CourseForm onClose={() => { setCreating(false); if (params.get('nuevo')) navigate('cursos') }} onCreated={course => { setCourses([course, ...courses]); setCourseId(course.id); setCreating(false); notify(`Creaste ${course.name}. Ahora carga la lista de estudiantes.`); navigate('inicio') }} />}
  </section>
}

function CourseForm({ course, onClose, onCreated }: { course?: Course; onClose: () => void; onCreated: (course: Course) => void }) {
  const { notify } = useFeedback()
  const [name, setName] = useState(course?.name ?? '')
  const [period, setPeriod] = useState(course?.period ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const saved = await request<Course>(course ? `/api/courses/${course.id}` : '/api/courses', { method: course ? 'PUT' : 'POST', body: JSON.stringify({ name: name.trim(), period: period.trim() || null, description: description.trim() || null }) })
      onCreated(saved)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el curso.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal title={course ? 'Editar curso' : 'Crear curso'} description={course ? undefined : 'Podrás cargar la lista y las notas enseguida.'} onClose={onClose} size="small">
    <form className="form" onSubmit={submit}>
      <Field label="Nombre del curso"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Programación I · Grupo A…" autoComplete="off" /></Field>
      <Field label="Periodo" optional><input maxLength={40} value={period} onChange={event => setPeriod(event.target.value)} placeholder="Ej. 2026-2…" autoComplete="off" /></Field>
      <Field label="Descripción" optional><textarea rows={2} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Jornada, salón o lo que te ayude a reconocerlo…" /></Field>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{saving ? 'Guardando…' : course ? 'Guardar cambios' : 'Crear curso'}</button></div>
    </form>
  </Modal>
}

function CourseStats({ data }: { data: { students: number; average: number | null; low: number; fallingBehind: number; weakestSubject: string | null } }) {
  return <dl className="course-stats">
    <div><dt>Estudiantes</dt><dd className="num">{data.students}</dd></div>
    <div><dt>Promedio</dt><dd className="num">{data.average == null ? '—' : formatGrade(data.average)}</dd></div>
    <div className={data.low ? 'is-alert' : ''}><dt>Refuerzo</dt><dd className="num">{data.low}</dd></div>
    {data.weakestSubject && <p className="course-weakest">Tema más bajo: <b>{data.weakestSubject}</b>{data.fallingBehind ? ` · ${data.fallingBehind} vienen bajando` : ''}</p>}
  </dl>
}
