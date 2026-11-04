import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { request, type Course } from '../api'
import type { PageProps } from '../App'
import { EmptyState, Field, Modal, Spinner, useFeedback } from '../components/ui'

export default function CoursesPage({ workspace, navigate, params }: PageProps & { params: URLSearchParams }) {
  const { courses, course: active, setCourseId, setCourses } = workspace
  const { notify, confirm } = useFeedback()
  const [creating, setCreating] = useState(params.get('nuevo') === '1')
  const [deleting, setDeleting] = useState<number | null>(null)
  useEffect(() => { if (params.get('nuevo') === '1') setCreating(true) }, [params])

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
        <button className="icon-btn icon-danger push" onClick={() => void remove(course)} disabled={deleting === course.id} aria-label={`Eliminar ${course.name}`}>{deleting === course.id ? <Spinner /> : <Trash2 size={16} />}</button></div>
      <h2>{course.name}</h2>
      <p>{course.description || 'Sin descripción.'}</p>
      <button className="btn btn-secondary" onClick={() => { setCourseId(course.id); navigate('inicio') }}>{active?.id === course.id ? 'Ir al inicio' : 'Abrir curso'}<ArrowRight size={16} aria-hidden /></button>
    </li>)}</ul> : <div className="panel"><EmptyState icon={<FolderOpen size={22} />} title="Crea tu primer curso" text="Por ejemplo: “Programación I · Grupo A”. Después cargas la lista y las notas." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear curso</button>} /></div>}

    {creating && <CourseForm onClose={() => { setCreating(false); if (params.get('nuevo')) navigate('cursos') }} onCreated={course => { setCourses([course, ...courses]); setCourseId(course.id); setCreating(false); notify(`Creaste ${course.name}. Ahora carga la lista de estudiantes.`); navigate('inicio') }} />}
  </section>
}

function CourseForm({ onClose, onCreated }: { onClose: () => void; onCreated: (course: Course) => void }) {
  const { notify } = useFeedback()
  const [name, setName] = useState('')
  const [period, setPeriod] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const course = await request<Course>('/api/courses', { method: 'POST', body: JSON.stringify({ name: name.trim(), period: period.trim() || null, description: description.trim() || null }) })
      onCreated(course)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo crear el curso.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal title="Crear curso" description="Podrás cargar la lista y las notas enseguida." onClose={onClose} size="small">
    <form className="form" onSubmit={submit}>
      <Field label="Nombre del curso"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Programación I · Grupo A…" autoComplete="off" /></Field>
      <Field label="Periodo" optional><input maxLength={40} value={period} onChange={event => setPeriod(event.target.value)} placeholder="Ej. 2026-2…" autoComplete="off" /></Field>
      <Field label="Descripción" optional><textarea rows={2} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Jornada, salón o lo que te ayude a reconocerlo…" /></Field>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{saving ? 'Creando…' : 'Crear curso'}</button></div>
    </form>
  </Modal>
}
