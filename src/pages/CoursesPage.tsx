import { useEffect, useState } from 'react'
import { ArrowRight, FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { request, type Course } from '../api'
import type { PageProps } from '../App'
import { EmptyState, Spinner, useFeedback } from '../components/ui'
import { CourseForm } from './courses/CourseForm'
import { CourseStats } from './courses/CourseStats'
import { DemoButton } from '../components/DemoButton'
import { groupBySemester } from '../lib/semesters'

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
      <div className="page-actions"><DemoButton onLoaded={workspace.loadCourses} variant="btn-ghost" /><button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear curso</button></div>
    </header>

    {courses.length ? <div className="semesters">{groupBySemester(courses).map(group => <section key={group.period || 'none'} className="semester">
      <h2 className={`semester-title${group.current ? ' is-current' : ''}`}>{group.label}<span className="seg-count">{group.courses.length}</span></h2>
      <ul className="courses">{group.courses.map(course => <li key={course.id} className={`panel course${active?.id === course.id ? ' is-active' : ''}`}>
      <div className="course-top"><FolderOpen size={18} aria-hidden /><span className="muted">{course.period || 'Sin periodo'}</span>{active?.id === course.id && <span className="pill pill-active">Abierto</span>}
        <button className="icon-btn push" onClick={() => setEditing(course)} aria-label={`Editar ${course.name}`}><Pencil size={16} /></button>
        <button className="icon-btn icon-danger" onClick={() => void remove(course)} disabled={deleting === course.id} aria-label={`Eliminar ${course.name}`}>{deleting === course.id ? <Spinner /> : <Trash2 size={16} />}</button></div>
      <h2>{course.name}</h2>
      <p>{course.description || 'Sin descripción.'}</p>
      {overview.get(course.id) && <CourseStats data={overview.get(course.id)!} />}
      <button className="btn btn-secondary" onClick={() => { setCourseId(course.id); navigate('inicio') }}>{active?.id === course.id ? 'Ir al inicio' : 'Abrir curso'}<ArrowRight size={16} aria-hidden /></button>
    </li>)}</ul>
    </section>)}</div> : <div className="panel"><EmptyState art="wave" title="Crea tu primer curso" text="Por ejemplo: “Programación I · Grupo A”. Después cargas la lista y las notas. ¿Quieres explorar primero? Carga cursos de demostración." action={<div className="button-row"><button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear curso</button><DemoButton onLoaded={workspace.loadCourses} /></div>} /></div>}

    {editing && <CourseForm course={editing} onClose={() => setEditing(null)} onCreated={saved => { setCourses(courses.map(c => c.id === saved.id ? saved : c)); setEditing(null); notify('Curso actualizado.') }} />}
    {creating && <CourseForm onClose={() => { setCreating(false); if (params.get('nuevo')) navigate('cursos') }} onCreated={course => { setCourses([course, ...courses]); setCourseId(course.id); setCreating(false); notify(`Creaste ${course.name}. Ahora carga la lista de estudiantes.`); navigate('inicio') }} />}
  </section>
}


