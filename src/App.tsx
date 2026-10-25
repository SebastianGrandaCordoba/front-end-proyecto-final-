import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BookOpen, BrainCircuit,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Copy,
  Download, FileText, Filter, FolderKanban, GraduationCap, Grid2X2, Lightbulb,
  LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles, Target,
  Trash2, Trophy, Upload, Users, WandSparkles, X, BellRing, Database, RotateCw, AlertTriangle, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { API_BASE, request, type AcademicLevel, type Course, type GeneratedWorkshop, type Grade, type Project, type Student, type Team } from './api'
import type { CourseMaterial } from './api'
import type { TeacherProfile } from './api'
import { createSpreadsheetTemplate, spreadsheetFileAsCsv } from './spreadsheet'

type Page = 'overview' | 'courses' | 'course' | 'students' | 'alerts' | 'projects' | 'teams' | 'workshops' | 'settings'
type Toast = { kind: 'success' | 'error' | 'info'; message: string }
type Candidate = Student & { level: AcademicLevel; average: number; gradeCount: number }
type SupportMode = 'workshop' | 'quiz'
type SupportTarget = { student: Candidate; mode: SupportMode }
type TeamDraft = { name: string; members: Candidate[]; score?: number; explanation?: string }

const navItems: { id: Page; label: string; icon: typeof Grid2X2 }[] = [
  { id: 'overview', label: 'Resumen', icon: Grid2X2 },
  { id: 'courses', label: 'Mis cursos', icon: FolderKanban },
  { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
  { id: 'students', label: 'Estudiantes y notas', icon: GraduationCap },
  { id: 'projects', label: 'Proyectos', icon: FolderKanban },
]

const levelLabels: Record<AcademicLevel, string> = { LOW: 'En refuerzo', MEDIUM: 'En proceso', HIGH: 'Avanzado' }
const levelScore: Record<AcademicLevel, number> = { LOW: 2.4, MEDIUM: 3.5, HIGH: 4.5 }

function levelOf(value?: string | null): AcademicLevel {
  const level = (value || '').toUpperCase()
  if (['LOW', 'BAJO', 'BAJA'].includes(level)) return 'LOW'
  if (['HIGH', 'ALTO', 'ALTA'].includes(level)) return 'HIGH'
  return 'MEDIUM'
}

function formatLevel(level: AcademicLevel) { return levelLabels[level] }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() }
function displayDate() { return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) }
function estimateBalance(members: Candidate[]) {
  if (!members.length) return 0
  const uniqueLevels = new Set(members.map(member => member.level)).size
  const diversity = uniqueLevels / Math.min(3, members.length) * 100
  const mean = members.reduce((sum, member) => sum + member.average, 0) / members.length
  const deviation = members.reduce((sum, member) => sum + Math.abs(member.average - mean), 0) / members.length
  const academicSpread = Math.max(0, 100 - deviation * 25)
  return Math.round(diversity * 0.7 + academicSpread * 0.3)
}

function App({ user, onLogout }: { user: TeacherProfile | null; onLogout: () => void }) {
  const [page, setPage] = useState<Page>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('fairteam.sidebarCollapsed') === 'true')
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const courseSelectionKey = `fairteam.activeCourse.${user?.id ?? 'guest'}`
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(() => {
    const stored = Number(localStorage.getItem(courseSelectionKey))
    return Number.isInteger(stored) && stored > 0 ? stored : null
  })
  const workshopStorageKey = `fairteam.workshops.${user?.id ?? 'guest'}.${selectedCourseId ?? 'none'}`
  const [savedWorkshops, setSavedWorkshops] = useState<GeneratedWorkshop[]>(() => {
    try { return JSON.parse(localStorage.getItem(workshopStorageKey) || '[]') as GeneratedWorkshop[] } catch { return [] }
  })
  const [loadedWorkshopKey, setLoadedWorkshopKey] = useState<string | null>(workshopStorageKey)
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'error'>('loading')
  const [loading, setLoading] = useState(false)
  const refreshGeneration = useRef(0)
  const [toast, setToast] = useState<Toast | null>(null)
  const [query, setQuery] = useState('')
  const [studentModal, setStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [workshopResult, setWorkshopResult] = useState<GeneratedWorkshop | null>(null)
  const [supportTarget, setSupportTarget] = useState<SupportTarget | null>(null)
  const [studentToReview, setStudentToReview] = useState<Candidate | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const notify = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const refresh = useCallback(async (courseId: number | null = selectedCourseId) => {
    const generation = ++refreshGeneration.current
    setLoading(true)
    const load = <T,>(promise: Promise<T>, setter: (value: T) => void) => promise.then(value => {
      if (generation === refreshGeneration.current) { setter(value); setApiStatus('online') }
      return true
    }).catch(() => false)
    if (!courseId) { setStudents([]); setGrades([]) }
    const courseLoads = Promise.all([
      courseId ? load(request<Student[]>(`/api/students?courseId=${courseId}`), setStudents) : Promise.resolve(false),
      courseId ? load(request<Grade[]>(`/api/grades?courseId=${courseId}`), setGrades) : Promise.resolve(false),
    ])
    const globalLoads = Promise.all([
      load(request<Project[]>('/api/projects'), setProjects),
      load(request<Team[]>('/api/teams'), setTeams),
    ])
    const coreResults = await courseLoads
    if (generation === refreshGeneration.current) {
      setLoading(false)
      if (!coreResults.some(Boolean)) setApiStatus('error')
    }
    void globalLoads.then(globalResults => {
      if (generation === refreshGeneration.current && !coreResults.some(Boolean) && !globalResults.some(Boolean)) {
      notify('No pudimos conectar con el backend. Revisa tu conexión y vuelve a intentar.', 'error')
      }
    })
  }, [notify, selectedCourseId])

  useEffect(() => {
    let active = true
    void request<Course[]>('/api/courses').then(items => {
      if (!active) return
      setCourses(items)
      const stored = Number(localStorage.getItem(courseSelectionKey))
      if (items.some(item => item.id === stored)) setSelectedCourseId(stored)
      else setSelectedCourseId(items[0]?.id ?? null)
      setApiStatus('online')
    }).catch(() => { if (active) { setApiStatus('error'); notify('No pudimos cargar tus cursos. Revisa la conexión e inténtalo de nuevo.', 'error') } })
    return () => { active = false }
  }, [courseSelectionKey, notify])
  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem(courseSelectionKey, String(selectedCourseId))
      void refresh(selectedCourseId)
    } else {
      localStorage.removeItem(courseSelectionKey)
      setStudents([]); setGrades([])
      if (courses.length === 0) { void refresh(null) }
    }
  }, [selectedCourseId, courseSelectionKey, refresh, courses.length])
  useEffect(() => {
    let workshops: GeneratedWorkshop[] = []
    try {
      const stored = localStorage.getItem(workshopStorageKey)
      const legacy = localStorage.getItem(`fairteam.workshops.${user?.id ?? 'guest'}`)
      workshops = JSON.parse(stored ?? legacy ?? '[]') as GeneratedWorkshop[]
    } catch { workshops = [] }
    setSavedWorkshops(workshops)
    setLoadedWorkshopKey(workshopStorageKey)
  }, [workshopStorageKey, user?.id])
  useEffect(() => {
    if (loadedWorkshopKey === workshopStorageKey) localStorage.setItem(workshopStorageKey, JSON.stringify(savedWorkshops))
  }, [savedWorkshops, workshopStorageKey, loadedWorkshopKey])

  const candidates = useMemo<Candidate[]>(() => students.map(student => {
    const marks = grades.filter(grade => Number(grade.studentId) === Number(student.id)).map(grade => Number(grade.grade)).filter(Number.isFinite)
    const average = marks.length ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length : levelScore[levelOf(student.academicLevel)]
    const level: AcademicLevel = marks.length ? (average < 3 ? 'LOW' : average < 4 ? 'MEDIUM' : 'HIGH') : levelOf(student.academicLevel)
    return { ...student, level, average, gradeCount: marks.length }
  }), [students, grades])

  const notifications = [
    ...(apiStatus === 'error' ? [{ id: 'backend', title: 'Backend sin conexión', detail: 'Comprueba el servicio y vuelve a cargar los datos.', page: 'settings' as Page }] : []),
    ...(candidates.some(student => student.gradeCount > 0 && student.level === 'LOW') ? [{ id: 'support', title: `${candidates.filter(student => student.gradeCount > 0 && student.level === 'LOW').length} estudiante(s) en refuerzo`, detail: 'Revisa sus promedios y prepara acompañamiento.', page: 'alerts' as Page }] : []),
    ...(savedWorkshops.length ? [{ id: 'workshops', title: `${savedWorkshops.length} taller(es) en tu biblioteca`, detail: 'Abre tus talleres recientes para consultarlos.', page: 'workshops' as Page }] : []),
  ]

  const setSaved = (workshop: GeneratedWorkshop) => {
    setWorkshopResult(workshop)
    setSavedWorkshops(current => [{ ...workshop, savedAt: new Date().toISOString() }, ...current.filter(item => item.title !== workshop.title)].slice(0, 20))
  }

  const openEditStudent = (student: Student) => { setEditingStudent(student); setStudentModal(true) }
  const openCreateStudent = () => {
    if (!selectedCourseId) { setPage('courses'); notify('Crea o selecciona un curso antes de agregar estudiantes.', 'info'); return }
    setEditingStudent(null); setStudentModal(true)
  }
  const title = page === 'settings' ? 'Configuración' : page === 'projects' ? 'Proyectos' : page === 'teams' ? 'Equipos' : page === 'course' ? 'Espacio del curso' : page === 'students' ? 'Estudiantes y notas' : page === 'workshops' ? 'Asistente IA' : navItems.find(item => item.id === page)?.label || 'Resumen'
  const selectedCourse = courses.find(course => course.id === selectedCourseId) ?? null

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Users size={21} strokeWidth={2.4} /></div>
          <span>fair<span className="brand-green">team</span><sup>✳</sup></span>
          <button className="icon-button sidebar-collapse-toggle" onClick={() => setSidebarCollapsed(value => { localStorage.setItem('fairteam.sidebarCollapsed', String(!value)); return !value })} aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <button className="workspace-switch workspace-switch-action" onClick={() => setPage(selectedCourse ? 'course' : 'courses')} title={selectedCourse ? 'Abrir espacio del curso' : 'Organizar tus cursos'}><div className="workspace-icon"><FolderKanban size={16} /></div><div><strong>{selectedCourse?.name || 'Organiza tus cursos'}</strong><span>{selectedCourse?.period || 'Asistente docente'}</span></div><ChevronDown size={15} /></button>
        <div className="nav-caption">INICIO</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {navItems.map(item => {
            const Icon = item.icon
            return <button key={item.id} title={item.label} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false) }}><Icon size={18} /><span>{item.label}</span></button>
          })}
        </nav>
        <div className="side-divider" />
        <div className="nav-caption">{selectedCourse ? 'DENTRO DEL CURSO' : 'CURSO ACTIVO'}</div>
        <button title="Espacio del curso" className={`nav-link ${page === 'course' ? 'active' : ''}`} onClick={() => { if (selectedCourse) setPage('course'); else setPage('courses'); setMobileNav(false) }} disabled={!selectedCourse}><FolderKanban size={18} /><span>Espacio del curso</span></button>
        <button title="Talleres y asistente" className={`nav-link ${page === 'workshops' ? 'active' : ''}`} onClick={() => { if (selectedCourse) setPage('workshops'); else setPage('courses'); setMobileNav(false) }} disabled={!selectedCourse}><BrainCircuit size={18} /><span>Talleres y asistente</span></button>
        <div className="side-divider" />
        <div className="nav-caption">HERRAMIENTAS</div>
        <button title="Configuración" className={`nav-link ${page === 'settings' ? 'active' : ''}`} onClick={() => { setPage('settings'); setMobileNav(false) }}><Settings2 size={18} /><span>Configuración</span></button>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><Lightbulb size={17} /></div><strong>Decisiones con contexto</strong><p>Revisa las señales y decide cómo acompañar a tu grupo.</p><button onClick={() => setPage('alerts')}>Ver seguimiento <ArrowRight size={14} /></button></div>
          <button className="profile-row profile-action" onClick={onLogout} title="Cerrar sesión"><div className="profile-avatar">{(user?.name || 'PG').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div><div className="profile-meta"><strong>{user?.name || 'Docente'}</strong><span>{user?.email || 'Sesión local'}</span></div><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumb"><span>FairTeam</span>{selectedCourse && <><ChevronRight size={14} /><span>{selectedCourse.name}</span></>}<ChevronRight size={14} /><strong>{title}</strong></div><label className="course-switcher-wrap"><FolderKanban size={15} /><select className="course-switcher" aria-label="Curso activo" value={selectedCourseId ?? ''} onChange={event => setSelectedCourseId(event.target.value ? Number(event.target.value) : null)}><option value="">Selecciona un curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}{course.period ? ` · ${course.period}` : ''}</option>)}</select><ChevronDown size={13} /></label></div>
          <div className="topbar-actions"><div className={`connection-pill ${apiStatus}`}><span className="connection-dot" />{apiStatus === 'loading' ? 'Conectando' : apiStatus === 'online' ? 'Sistema activo' : 'Sin conexión'}</div><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(open => !open)} aria-label="Notificaciones" aria-expanded={notificationsOpen}><Bell size={18} />{notifications.length > 0 && <i />}</button>{notificationsOpen && <NotificationsPanel notifications={notifications} onSelect={target => { setPage(target); setNotificationsOpen(false) }} />}</div><button className="top-account-button" onClick={() => setPage('settings')} title="Abrir configuración de cuenta"><div className="top-avatar">{user?.name?.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PG'}</div></button></div>
        </header>

        <div className="page-content page-enter" key={page}>
          {page === 'overview' && <Overview course={selectedCourse} courses={courses} teacherName={user?.name || 'Profesor'} students={candidates} teams={teams} grades={grades} workshops={savedWorkshops} busy={loading} onNavigate={setPage} onSelectCourse={id => { setSelectedCourseId(id); setPage('course') }} onCreateStudent={openCreateStudent} onRefresh={() => void refresh()} onSelectWorkshop={workshop => { setWorkshopResult(workshop); setPage('workshops') }} />}
          {page === 'courses' && <CoursesPage courses={courses} selectedCourseId={selectedCourseId} onSelect={id => { setSelectedCourseId(id); setPage('course') }} onCreate={course => { setCourses(current => [course, ...current]); setSelectedCourseId(course.id); setPage('course') }} onDelete={id => { setCourses(current => current.filter(course => course.id !== id)); if (selectedCourseId === id) setSelectedCourseId(courses.find(course => course.id !== id)?.id ?? null) }} notify={notify} />}
          {page === 'course' && selectedCourse && <CourseWorkspace course={selectedCourse} students={candidates} grades={grades} average={grades.length ? grades.reduce((sum, grade) => sum + Number(grade.grade || 0), 0) / grades.length : null} low={candidates.filter(student => student.gradeCount > 0 && student.level === 'LOW').length} workshopCount={savedWorkshops.length} onNavigate={setPage} />}
          {page === 'course' && !selectedCourse && <section className="panel no-course-state"><EmptyState icon={<FolderKanban size={23} />} title="Selecciona un curso" text="Tus estudiantes, materiales y recomendaciones se organizan dentro de cada curso." action={<button className="button button-dark" onClick={() => setPage('courses')}><FolderKanban size={15} /> Abrir mis cursos</button>} /></section>}
          {page === 'students' && <StudentsPage students={candidates} courseId={selectedCourseId} query={query} setQuery={setQuery} busy={loading} onCreate={openCreateStudent} onEdit={openEditStudent} onRefresh={() => void refresh()} onSupport={setStudentToReview} notify={notify} />}
          {page === 'alerts' && <LearningAlerts students={candidates} onWorkshops={() => setPage('workshops')} onStudents={() => setPage('students')} onSupport={setStudentToReview} />}
          {page === 'projects' && <ProjectsPage projects={projects} teams={teams} onRefresh={() => void refresh()} onManageTeams={projectId => { setActiveProjectId(String(projectId)); setPage('teams') }} notify={notify} />}
          {page === 'teams' && <TeamsPage students={candidates} projects={projects} teams={teams} initialProjectId={activeProjectId} onRefresh={() => void refresh()} notify={notify} />}
          {page === 'workshops' && <WorkshopsPage saved={savedWorkshops} result={workshopResult} course={selectedCourse} supportTarget={supportTarget} onSupportComplete={() => setSupportTarget(null)} summary={{ students: students.length, graded: candidates.filter(student => student.gradeCount > 0).length, low: candidates.filter(student => student.gradeCount > 0 && student.level === 'LOW').length, medium: candidates.filter(student => student.gradeCount > 0 && student.level === 'MEDIUM').length, high: candidates.filter(student => student.gradeCount > 0 && student.level === 'HIGH').length, average: grades.length ? grades.reduce((sum, grade) => sum + Number(grade.grade || 0), 0) / grades.length : null }} onGenerate={setSaved} onSelect={setWorkshopResult} notify={notify} />}
          {page === 'settings' && <SettingsPage user={user} apiStatus={apiStatus} students={students} grades={grades} projects={projects} teams={teams} workshops={savedWorkshops} onRefresh={() => void refresh()} onClearWorkshops={() => setSavedWorkshops([])} onLogout={onLogout} notify={notify} />}
          <footer className="page-footer"><span>FairTeam · Aprender en equipo</span><span>Diseñado para construir aulas más equilibradas</span></footer>
        </div>
      </main>

      {mobileNav && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
      {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.kind === 'success' ? <CheckCircle2 size={18} /> : toast.kind === 'error' ? <CircleHelp size={18} /> : <Lightbulb size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Cerrar aviso"><X size={15} /></button></div>}
      {studentModal && <StudentDialog student={editingStudent} courseId={selectedCourseId} onClose={() => setStudentModal(false)} onSaved={() => { setStudentModal(false); void refresh() }} notify={notify} />}
      {studentToReview && <StudentSupportDialog student={studentToReview} grades={grades.filter(grade => Number(grade.studentId) === Number(studentToReview.id))} onClose={() => setStudentToReview(null)} onGenerate={mode => { setSupportTarget({ student: studentToReview, mode }); setStudentToReview(null); setPage('workshops') }} />}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}

function CourseWorkspace({ course, students, grades, average, low, workshopCount, onNavigate }: {
  course: Course; students: Candidate[]; grades: Grade[]; average: number | null; low: number; workshopCount: number; onNavigate: (page: Page) => void
}) {
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(true)
  useEffect(() => {
    let active = true
    void request<CourseMaterial[]>(`/api/courses/${course.id}/materials`).then(items => {
      if (active) setMaterials(items)
    }).catch(() => { if (active) setMaterials([]) }).finally(() => { if (active) setMaterialsLoading(false) })
    return () => { active = false }
  }, [course.id])
  return <div className="course-workspace-page">
    <div className="course-workspace-hero"><div><div className="command-kicker"><span className="command-live-dot"/> ESPACIO DEL CURSO <span className="command-date">{course.period || 'Periodo sin indicar'}</span></div><h1>{course.name}</h1><p>{course.description || 'Aquí se reúnen el progreso del grupo, los materiales de clase y el asistente de aprendizaje de este curso.'}</p><div className="course-hero-actions"><button className="button button-dark" onClick={() => onNavigate('workshops')}><Sparkles size={16}/> Preparar un taller <ArrowRight size={15}/></button><button className="button button-outline" onClick={() => onNavigate('students')}><Users size={16}/> Revisar estudiantes</button></div></div><div className="course-workspace-mark"><BrainCircuit size={34}/><span>FAIRTEAM<br/>ASISTENTE DOCENTE</span></div></div>
    <div className="course-workspace-stats"><button onClick={() => onNavigate('students')}><GraduationCap size={18}/><span><b>{students.length}</b><small>estudiantes</small></span><ArrowUpRight size={15}/></button><button onClick={() => onNavigate('students')}><BookOpen size={18}/><span><b>{grades.length}</b><small>notas registradas</small></span><ArrowUpRight size={15}/></button><button onClick={() => onNavigate('alerts')}><Activity size={18}/><span><b>{low}</b><small>en seguimiento</small></span><ArrowUpRight size={15}/></button><button onClick={() => onNavigate('workshops')}><FileText size={18}/><span><b>{materialsLoading ? '…' : materials.length}</b><small>materiales de clase</small></span><ArrowUpRight size={15}/></button></div>
    <div className="course-workspace-grid">
      <section className="course-focus-card"><div className="course-focus-top"><span>LECTURA DEL GRUPO</span><span className="course-status-pill"><i/> ACTUALIZADO CON TUS NOTAS</span></div><h2>{low ? `${low} ${low === 1 ? 'estudiante requiere' : 'estudiantes requieren'} acompañamiento.` : grades.length ? 'El grupo avanza sin alertas de refuerzo.' : 'Aún faltan notas para leer el progreso.'}</h2><p>{average === null ? 'Importa las notas desde Excel para obtener una lectura inicial del grupo.' : `El promedio registrado es ${average.toFixed(1)} sobre 5. La clasificación orienta el seguimiento; tú decides qué intervención aplicar.`}</p><div className="course-focus-footer"><span><Activity size={15}/> Promedio {average === null ? 'pendiente' : `${average.toFixed(1)} / 5`}</span><button onClick={() => onNavigate(grades.length ? 'alerts' : 'students')}>{grades.length ? 'Revisar señales' : 'Cargar notas'} <ArrowRight size={14}/></button></div></section>
      <button className="course-action-card course-ai-card" onClick={() => onNavigate('workshops')}><span className="course-action-icon"><BrainCircuit size={21}/></span><span className="course-action-label">ASISTENTE DE ESTE CURSO</span><b>Material + notas, una propuesta con contexto.</b><small>Guarda materiales aquí y genera actividades para los temas que estás enseñando. {workshopCount} propuestas recientes.</small><span className="course-action-link">Abrir asistente <ArrowRight size={15}/></span></button>
      <button className="course-action-card course-students-card" onClick={() => onNavigate('students')}><span className="course-action-icon"><Users size={21}/></span><span className="course-action-label">LISTA Y CALIFICACIONES</span><b>Actualiza el pulso del grupo.</b><small>Importa estudiantes y notas desde tus archivos Excel o administra registros existentes.</small><span className="course-action-link">Ver estudiantes <ArrowRight size={15}/></span></button>
      <button className="course-action-card course-alerts-card" onClick={() => onNavigate('alerts')}><span className="course-action-icon"><AlertTriangle size={21}/></span><span className="course-action-label">SEGUIMIENTO</span><b>Encuentra dónde enfocar tu clase.</b><small>Revisa estudiantes que podrían beneficiarse de un refuerzo y entiende la señal en sus notas.</small><span className="course-action-link">Ver seguimiento <ArrowRight size={15}/></span></button>
    </div>
    <div className="course-library-footnote"><ShieldCheck size={15}/> Este curso está asociado a tu cuenta docente. Sus listas, notas y materiales no se mezclan con los de otros cursos.</div>
  </div>
}

function CoursesPage({ courses, selectedCourseId, onSelect, onCreate, onDelete, notify }: {
  courses: Course[]; selectedCourseId: number | null; onSelect: (id: number) => void; onCreate: (course: Course) => void;
  onDelete: (id: number) => void; notify: (message: string, kind?: Toast['kind']) => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [period, setPeriod] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const createCourse = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const course = await request<Course>('/api/courses', { method: 'POST', body: JSON.stringify({ name: name.trim(), period: period.trim() || null, description: description.trim() || null }) })
      onCreate(course); setCreating(false); setName(''); setPeriod(''); setDescription(''); notify(`Creaste el curso ${course.name}.`)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo crear el curso.', 'error') }
    finally { setSaving(false) }
  }
  const deleteCourse = async (course: Course) => {
    if (!window.confirm(`¿Eliminar la carpeta “${course.name}”? Solo se puede eliminar si no contiene estudiantes ni notas.`)) return
    setDeleting(course.id)
    try { await request<void>(`/api/courses/${course.id}`, { method: 'DELETE' }); onDelete(course.id); notify('Curso eliminado.') }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar el curso.', 'error') }
    finally { setDeleting(null) }
  }
  return <>
    <PageHeading eyebrow="ESPACIOS DE APRENDIZAJE" title="Tus cursos" description="Cada curso tiene su propia lista de estudiantes, notas, alertas y biblioteca de talleres." action={<button className="button button-dark" onClick={() => setCreating(true)}><Plus size={16} /> Crear curso</button>} />
    <div className="course-intro panel"><span className="course-intro-icon"><FolderKanban size={21} /></span><div><strong>Un espacio separado para cada grupo</strong><p>Abre un curso para encontrar juntos su lista, calificaciones, biblioteca de materiales y asistente de aprendizaje.</p></div><span className="course-count">{courses.length} {courses.length === 1 ? 'curso' : 'cursos'}</span></div>
    {courses.length ? <div className="course-folder-grid">{courses.map((course, index) => <article className={`course-folder-card course-tone-${index % 4} ${selectedCourseId === course.id ? 'selected' : ''}`} key={course.id}>
      <div className="course-folder-top"><span className="course-folder-icon"><FolderKanban size={21} /></span><span className="course-folder-period">{course.period || 'Periodo sin indicar'}</span><button className="icon-button small-icon danger-hover" onClick={() => void deleteCourse(course)} disabled={deleting === course.id} aria-label={`Eliminar curso ${course.name}`}>{deleting === course.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}</button></div>
      <h2>{course.name}</h2><p>{course.description || 'Lista, notas y seguimiento de aprendizaje de este grupo.'}</p>
      <div className="course-folder-footer"><span><GraduationCap size={14} /> Espacio docente</span><button className="button button-outline" onClick={() => onSelect(course.id)}>Abrir curso <ArrowRight size={14} /></button></div>
    </article>)}</div> : <section className="panel courses-empty"><EmptyState icon={<FolderKanban size={22} />} title="Crea tu primer curso" text="Organiza tus grupos por semestre, sección o periodo. Después podrás cargar estudiantes y notas dentro de cada uno." action={<button className="button button-dark" onClick={() => setCreating(true)}><Plus size={15} /> Crear primer curso</button>} /></section>}
    {creating && <Modal title="Crear curso" onClose={() => setCreating(false)}><form className="form-stack" onSubmit={createCourse}><label>Nombre del curso<input required autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Cuarto semestre A" /></label><label>Periodo <span className="optional-label">Opcional</span><input maxLength={40} value={period} onChange={event => setPeriod(event.target.value)} placeholder="Ej. 2026-2" /></label><label>Descripción <span className="optional-label">Opcional</span><textarea rows={3} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Materia, jornada o detalles del grupo" /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCreating(false)}>Cancelar</button><button type="submit" className="button button-dark" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Creando…' : 'Crear curso'}</button></div></form></Modal>}
  </>
}

type AppNotice = { id: string; title: string; detail: string; page: Page }

function NotificationsPanel({ notifications, onSelect }: { notifications: AppNotice[]; onSelect: (page: Page) => void }) {
  return <section className="notification-popover" aria-label="Notificaciones"><div className="notification-popover-head"><div><strong>Notificaciones</strong><span>{notifications.length ? `${notifications.length} aviso(s) para revisar` : 'Estás al día'}</span></div><BellRing size={17} /></div>{notifications.length ? <div className="notification-list">{notifications.map(item => <button className="notification-item" key={item.id} onClick={() => onSelect(item.page)}><i className={`notice-dot notice-${item.id}`} /><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="notification-empty"><CheckCircle2 size={20} /><span>No hay avisos pendientes. Los avisos aparecerán aquí cuando haya estudiantes en refuerzo o una conexión que revisar.</span></div>}</section>
}

function SettingsPage({ user, apiStatus, students, grades, projects, teams, workshops, onRefresh, onClearWorkshops, onLogout, notify }: { user: TeacherProfile | null; apiStatus: 'loading' | 'online' | 'error'; students: Student[]; grades: Grade[]; projects: Project[]; teams: Team[]; workshops: GeneratedWorkshop[]; onRefresh: () => void; onClearWorkshops: () => void; onLogout: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [checking, setChecking] = useState(false)
  const [teamSize, setTeamSize] = useState(() => {
    const stored = Number(localStorage.getItem('fairteam.defaultTeamSize'))
    return [2, 3, 4, 5, 6].includes(stored) ? stored : 3
  })
  const exportBackup = () => {
    const backup = { exportedAt: new Date().toISOString(), account: user?.email || 'Vista previa local', students, grades, projects, teams, generatedWorkshops: workshops }
    downloadFile(`fairteam-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
    notify('Respaldo descargado en tu dispositivo.')
  }
  const verifyConnection = async () => {
    setChecking(true)
    try {
      const status = await request<{ application?: string; status?: string }>('/')
      notify(`Backend disponible${status.application ? `: ${status.application}` : ''}.`)
      onRefresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo conectar con el backend.', 'error') }
    finally { setChecking(false) }
  }
  const clearWorkshops = () => {
    if (!workshops.length) return notify('Tu biblioteca de talleres ya está vacía.', 'info')
    if (!window.confirm(`¿Eliminar los ${workshops.length} talleres guardados en este navegador?`)) return
    onClearWorkshops()
    notify('Biblioteca de talleres vaciada.')
  }
  return <>
    <PageHeading eyebrow="PREFERENCIAS Y CUENTA" title="Configuración" description="Administra tu sesión, comprueba la conexión y descarga una copia de los datos que carga esta vista." />
    <div className="settings-grid">
      <section className="panel settings-card account-settings"><div className="settings-card-heading"><span className="settings-icon mint-icon"><ShieldCheck size={19} /></span><div><div className="eyebrow">CUENTA</div><h2>Tu sesión</h2></div></div><div className="settings-account-row"><span className="settings-account-fallback">{(user?.name || 'PG').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{user?.name || 'Docente'}</strong><span>{user?.email || 'Sesión no iniciada'}</span></div></div><div className="settings-detail-row"><span>Tipo de acceso</span><b>Cuenta FairTeam</b></div><div className="settings-detail-row"><span>Rol</span><b>{user?.role || 'Docente'}</b></div><button className="button button-outline settings-full-button" onClick={onLogout} disabled={!user}><LogOut size={16} /> Cerrar sesión</button></section>
      <section className="panel settings-card connection-settings"><div className="settings-card-heading"><span className={`settings-icon ${apiStatus === 'online' ? 'mint-icon' : 'peach-icon'}`}><Database size={19} /></span><div><div className="eyebrow">SERVICIO</div><h2>Conexión con FairTeam</h2></div></div><div className={`settings-status settings-status-${apiStatus}`}><i />{apiStatus === 'loading' ? 'Comprobando conexión' : apiStatus === 'online' ? 'Backend conectado' : 'No se pudo conectar'}</div><div className="settings-detail-row"><span>URL de API</span><code>{API_BASE}</code></div><p>Las listas de estudiantes, notas, proyectos y equipos se consultan desde este backend.</p><button className="button button-outline settings-full-button" onClick={() => void verifyConnection()} disabled={checking}>{checking ? <LoaderCircle size={16} className="spin" /> : <RotateCw size={16} />}{checking ? 'Comprobando…' : 'Comprobar y actualizar datos'}</button></section>
      <section className="panel settings-card preference-settings"><div className="settings-card-heading"><span className="settings-icon lilac-icon"><Users size={19} /></span><div><div className="eyebrow">PREFERENCIAS</div><h2>Formación de equipos</h2></div></div><label className="settings-select-label">Tamaño predeterminado de equipos<select value={teamSize} onChange={event => { const value = Number(event.target.value); setTeamSize(value); localStorage.setItem('fairteam.defaultTeamSize', String(value)); notify(`El tamaño predeterminado será de ${value} personas.`) }}>{[2, 3, 4, 5, 6].map(size => <option value={size} key={size}>{size} personas</option>)}</select></label><p>Este valor se usa al abrir el organizador. Si eliges un proyecto que ya existe, se conserva el tamaño definido en ese proyecto.</p></section>
      <section className="panel settings-card data-settings"><div className="settings-card-heading"><span className="settings-icon blue-icon"><Download size={19} /></span><div><div className="eyebrow">TUS DATOS</div><h2>Respaldo y biblioteca</h2></div></div><div className="settings-counts"><span><b>{students.length}</b> estudiantes</span><span><b>{grades.length}</b> notas</span><span><b>{projects.length}</b> proyectos</span><span><b>{teams.length}</b> equipos</span></div><button className="button button-dark settings-full-button" onClick={exportBackup}><Download size={16} /> Descargar respaldo JSON</button><button className="button button-outline settings-full-button" onClick={downloadGradeTemplate}><FileText size={16} /> Descargar plantilla de notas CSV</button><button className="text-button settings-clear-button" onClick={clearWorkshops} disabled={!workshops.length}><Trash2 size={14} /> Vaciar biblioteca de talleres ({workshops.length})</button><small>El respaldo contiene los datos disponibles en esta sesión y los talleres guardados en este navegador.</small></section>
    </div>
    <div className="info-banner settings-note"><ShieldCheck size={18} /><div><strong>Acceso protegido por la sesión</strong><p>Las solicitudes a la API incluyen un token temporal. No compartas tu contraseña ni las claves privadas de los servicios.</p></div></div>
  </>
}

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadWorkshopDocument(workshop: GeneratedWorkshop, includeAnswerKey = false) {
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
  const objectives = workshop.learningObjectives.map(item => `<li>${escape(item)}</li>`).join('')
  const activities = workshop.activities.map((item, index) => `<article><h3>${index + 1}. ${escape(item.title)} <small>${item.estimatedMinutes} min</small></h3><p>${escape(item.instructions)}</p></article>`).join('')
  const questions = workshop.assessment.map((item, index) => `<article class="question"><h3>${index + 1}. ${escape(item.question)}</h3><ul>${item.options.map(option => `<li>${escape(option)}</li>`).join('')}</ul>${includeAnswerKey ? `<div class="answer-key"><b>Clave docente:</b> ${escape(item.correctAnswer)}. ${escape(item.explanation)}</div>` : ''}</article>`).join('')
  const sources = workshop.sourceReferences.map(escape).join(' · ') || 'No especificadas'
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(workshop.title)}</title><style>
    :root{font-family:Inter,Arial,sans-serif;color:#20253a;background:#f7f8fc}body{margin:0;padding:40px 18px}.sheet{max-width:820px;margin:auto;padding:48px;background:#fff;border:1px solid #e8eaf2;border-radius:14px;box-shadow:0 18px 50px #29315b12}.brand{color:#5148b6;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{font-size:32px;line-height:1.15;margin:18px 0 10px;letter-spacing:-.04em}.meta{color:#737b91;font-size:13px}.summary{padding:16px 18px;background:#efedff;border-left:3px solid #6258c9;border-radius:8px;line-height:1.65;margin:24px 0}section{margin:28px 0}h2{font-size:17px;margin-bottom:13px}li,p{line-height:1.65}article{padding:14px 16px;margin:10px 0;border:1px solid #e8eaf2;border-radius:10px;break-inside:avoid}article h3{font-size:14px;margin:0 0 6px}article p{margin:6px 0;white-space:pre-line}small{color:#737b91;font-weight:500}.answer-key{margin-top:12px;padding:10px;border-radius:7px;background:#f7f8fc;color:#424963}footer{margin-top:30px;padding-top:15px;border-top:1px solid #e8eaf2;color:#737b91;font-size:11px}@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;box-shadow:none;padding:20mm}}
    </style><body><main class="sheet"><div class="brand">FairTeam · material para clase</div><h1>${escape(workshop.title)}</h1><div class="meta">${escape(workshop.subject)} · Nivel: ${escape(formatLevel(levelOf(workshop.targetLevel)))}</div><p class="summary">${escape(workshop.summary)}</p><section><h2>Objetivos de aprendizaje</h2><ul>${objectives}</ul></section>${activities ? `<section><h2>Actividades</h2>${activities}</section>` : ''}<section><h2>Comprobación del aprendizaje</h2>${questions}</section><footer>Material consultado: ${sources}<br>Propuesta generada con FairTeam. El docente debe revisarla antes de compartirla.</footer></main></body></html>`
  const safeName = workshop.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'actividad-fairteam'
  downloadFile(`${safeName}${includeAnswerKey ? '-clave-docente' : ''}.html`, html, 'text/html;charset=utf-8')
}

function downloadGradeTemplate() {
  downloadFile('plantilla-notas-fairteam.csv', '\uFEFFstudentName,studentEmail,subject,grade,period\r\n', 'text/csv;charset=utf-8')
}

function downloadRosterTemplate() {
  downloadFile('plantilla-estudiantes-fairteam.csv', '\uFEFFname,email,academicLevel\r\n', 'text/csv;charset=utf-8')
}

async function downloadXlsxTemplate(filename: string, kind: 'roster' | 'grades') {
  const bytes = await createSpreadsheetTemplate(kind)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Overview({ course, courses, teacherName, students, teams, grades, workshops, busy, onNavigate, onSelectCourse, onCreateStudent, onRefresh, onSelectWorkshop }: { course: Course | null; courses: Course[]; teacherName: string; students: Candidate[]; teams: Team[]; grades: Grade[]; workshops: GeneratedWorkshop[]; busy: boolean; onNavigate: (page: Page) => void; onSelectCourse: (id: number) => void; onCreateStudent: () => void; onRefresh: () => void; onSelectWorkshop: (workshop: GeneratedWorkshop) => void }) {
  const low = students.filter(student => student.gradeCount > 0 && student.level === 'LOW').length
  const medium = students.filter(student => student.gradeCount > 0 && student.level === 'MEDIUM').length
  const high = students.filter(student => student.gradeCount > 0 && student.level === 'HIGH').length
  const avg = grades.length ? grades.reduce((sum, grade) => sum + Number(grade.grade || 0), 0) / grades.length : null
  const focusStudents = students.filter(student => student.gradeCount > 0 && student.level === 'LOW').slice(0, 4)
  if (!course) return <div className="command-empty"><div className="command-kicker"><span className="command-live-dot" /> TU ESPACIO DOCENTE</div><h1>Hola, {teacherName.split(/\s+/)[0]}.<br /><span>Empecemos por tus cursos.</span></h1><p>Crea un curso para organizar estudiantes, seguir su progreso y preparar refuerzos con contexto.</p><button className="button button-dark" onClick={() => onNavigate('courses')}><Plus size={16} /> Crear mi primer curso <ArrowRight size={15} /></button></div>
  return <>
    <div className="command-hero"><div className="command-hero-copy"><div className="command-kicker"><span className="command-live-dot" /> FAIRTEAM · RESUMEN DOCENTE <span className="command-date">{displayDate()}</span></div><h1>Hola, {teacherName.split(/\s+/)[0]}. Aquí está el pulso de tus cursos.</h1><p>Consulta el avance, detecta a quién acompañar y decide el siguiente paso para tu clase.</p><div className="command-actions"><button className="button button-dark" onClick={() => onNavigate('alerts')}><Activity size={16} /> Ver señales de aprendizaje <ArrowRight size={15} /></button><button className="button button-ghost" onClick={onCreateStudent}><Plus size={16} /> Añadir estudiante</button></div></div><aside className="dashboard-ai-summary"><div className="dashboard-ai-heading"><span className="dashboard-ai-icon"><BrainCircuit size={18}/></span><div><b>FairTeam AI</b><small>Contexto de {course.name}</small></div><span className="ai-status-dot" title="Asistente listo"/></div><div className="dashboard-ai-metrics"><div><b>{students.length}</b><span>estudiantes</span></div><div><b>{avg === null ? '—' : avg.toFixed(1)}</b><span>promedio / 5</span></div><div><b>{low}</b><span>por acompañar</span></div></div><p>{low ? `${low} estudiante${low === 1 ? '' : 's'} podría${low === 1 ? '' : 'n'} beneficiarse de una actividad de refuerzo.` : avg === null ? 'Carga las notas para ver señales útiles para tu curso.' : 'Por ahora no hay señales de refuerzo según las notas cargadas.'}</p></aside></div>
    <div className="command-section-head"><div><div className="eyebrow">LECTURA DEL CURSO ACTIVO</div><h2>Así va {course.name}</h2></div><button className="text-button" onClick={() => onNavigate('workshops')}><Sparkles size={15}/> Preparar refuerzo <ArrowRight size={14}/></button></div>
    {busy ? <div className="metric-grid metric-skeleton-grid" aria-label="Cargando datos del curso"><div className="metric-skeleton"><i/><i/><i/></div><div className="metric-skeleton"><i/><i/><i/></div><div className="metric-skeleton"><i/><i/><i/></div></div> : <div className="metric-grid">
      <MetricCard icon={<GraduationCap size={19} />} label="Estudiantes" value={students.length} note={`en ${course.name}`} tone="mint" onClick={() => onNavigate('students')} />
      <MetricCard icon={<AlertTriangle size={19} />} label="Necesitan atención" value={low} note={students.length ? `${Math.round(low / students.length * 100)}% del grupo` : 'según notas disponibles'} tone="peach" onClick={() => onNavigate('alerts')} />
      <MetricCard icon={<Activity size={19} />} label="Promedio general" value={avg === null ? '—' : `${avg.toFixed(1)}`} note={avg === null ? 'importa notas para calcularlo' : 'sobre 5.0'} tone="blue" onClick={() => onNavigate('students')} />
    </div>}
    <section className="command-courses"><div className="command-section-head"><div><div className="eyebrow">TUS ESPACIOS</div><h2>Cursos en seguimiento <span>{courses.length.toString().padStart(2,'0')}</span></h2></div><button className="text-button" onClick={() => onNavigate('courses')}>Administrar cursos <ArrowRight size={14}/></button></div><div className="command-course-grid">{courses.map((item,index)=><button key={item.id} className={`command-course-card command-course-tone-${index%4} ${item.id===course.id?'is-current':''}`} onClick={()=>onSelectCourse(item.id)}><span className="command-course-index">0{index+1}</span><span className="command-course-icon"><FolderKanban size={18}/></span><span className="command-course-copy"><b>{item.name}</b><small>{item.period || 'Espacio de aprendizaje'}</small></span><span className="command-course-open">{item.id===course.id?'EN FOCO':'ABRIR'} <ArrowUpRight size={14}/></span></button>)}<button className="command-course-add" onClick={()=>onNavigate('courses')}><Plus size={21}/><span><b>Añadir un curso</b><small>Organiza otro grupo</small></span></button></div></section>
    <div className="dashboard-grid">
      <section className="panel level-panel"><div className="panel-heading"><div><div className="eyebrow">PANORAMA DEL AULA</div><h2>Niveles de aprendizaje</h2></div><button className="text-button" onClick={() => onNavigate('students')}>Ver estudiantes <ArrowRight size={14} /></button></div><p className="panel-copy">Una mirada rápida a cómo va avanzando tu grupo.</p>{students.length ? <div className="levels-content"><div className="level-chart"><div className="chart-y-labels"><span>{students.length}</span><span>{Math.ceil(students.length * .66)}</span><span>{Math.ceil(students.length * .33)}</span><span>0</span></div><div className="bar-chart"><div className="chart-grid-lines"><i /><i /><i /><i /></div>{[{ label: 'En refuerzo', value: low, color: 'var(--coral)' }, { label: 'En proceso', value: medium, color: 'var(--yellow)' }, { label: 'Avanzado', value: high, color: 'var(--green)' }].map(item => <div className="bar-group" key={item.label}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(item.value ? 9 : 0, students.length ? item.value / students.length * 100 : 0)}%`, background: item.color }}><span>{item.value}</span></div></div><span className="bar-label">{item.label}</span></div>)}</div></div><div className="level-legend"><span><i className="legend-dot coral" />En refuerzo <b>{low}</b></span><span><i className="legend-dot yellow" />En proceso <b>{medium}</b></span><span><i className="legend-dot green" />Avanzado <b>{high}</b></span></div></div> : <EmptyState icon={<Users size={21} />} title="Tu aula empieza aquí" text="Agrega estudiantes o importa sus notas para ver el panorama del grupo." action={<button className="button button-outline" onClick={onNavigate.bind(null, 'students')}><Plus size={15} /> Ir a estudiantes</button>} />}</section>
      <section className="panel focus-panel"><div className="panel-heading"><div><div className="eyebrow">ACOMPAÑAMIENTO</div><h2>Para tener en cuenta</h2></div><span className="soft-icon coral-icon"><Lightbulb size={18} /></span></div>{focusStudents.length ? <><p className="panel-copy">Estudiantes que podrían beneficiarse de un taller de refuerzo.</p><div className="focus-list">{focusStudents.map(student => <div className="focus-student" key={student.id}><Avatar name={student.name} /><div className="focus-info"><strong>{student.name}</strong><span>{student.average.toFixed(1)} / 5.0 · {student.email || 'Sin correo registrado'}</span></div><span className="level-badge level-low">Refuerzo</span></div>)}</div><button className="button button-soft-coral full-button" onClick={() => onNavigate('workshops')}><Sparkles size={16} /> Preparar taller de refuerzo <ArrowRight size={15} /></button></> : <EmptyState icon={<CheckCircle2 size={21} />} title={students.length ? 'Todo va tomando forma' : 'Aún no hay alertas'} text={students.length ? 'No hay estudiantes clasificados en nivel de refuerzo por ahora.' : 'Al importar notas podrás identificar quién necesita apoyo.'} action={<button className="text-button" onClick={() => onNavigate('students')}>Revisar estudiantes <ArrowRight size={14} /></button>} />}</section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel shortcuts-panel"><div className="panel-heading"><div><div className="eyebrow">SIGUIENTE PASO</div><h2>¿Qué quieres hacer?</h2></div></div><div className="shortcut-grid"><button className="shortcut-card" onClick={() => onNavigate('students')}><span className="shortcut-icon peach-icon"><ArrowDownToLine size={19} /></span><span><b>Importar notas</b><small>Actualiza el seguimiento del curso</small></span><ArrowUpRight size={16} /></button><button className="shortcut-card" onClick={() => onNavigate('alerts')}><span className="shortcut-icon mint-icon"><Activity size={19} /></span><span><b>Revisar alertas</b><small>Entiende por qué alguien requiere apoyo</small></span><ArrowUpRight size={16} /></button><button className="shortcut-card" onClick={() => onNavigate('workshops')}><span className="shortcut-icon lilac-icon"><BrainCircuit size={19} /></span><span><b>Crear actividad de refuerzo</b><small>Parte de un material que tú eliges</small></span><ArrowUpRight size={16} /></button></div></section>
      <section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">TU ACTIVIDAD</div><h2>Lo más reciente</h2></div><button className="icon-button small-icon" onClick={onRefresh} aria-label="Actualizar"><Activity size={16} /></button></div>{workshops.length || teams.length ? <div className="activity-list">{workshops.slice(0, 2).map((workshop, index) => <button className="activity-item activity-action" key={`${workshop.title}-${index}`} onClick={() => onSelectWorkshop(workshop)}><div className="activity-icon lilac-icon"><BookOpen size={16} /></div><div><b>{workshop.title}</b><span>Taller guardado en este navegador</span></div><ChevronRight size={15} /></button>)}{teams.slice(0, 2).map(team => <button className="activity-item activity-action" key={team.id} onClick={() => onNavigate('teams')}><div className="activity-icon mint-icon"><Users size={16} /></div><div><b>{team.name}</b><span>{team.project?.name || 'Equipo guardado'}</span></div><ChevronRight size={15} /></button>)}</div> : <EmptyState icon={<Clock3 size={20} />} title="Tu actividad aparecerá aquí" text="Cuando importes notas, crees grupos o generes talleres, los verás en este espacio." />}</section>
    </div>
  </>
}

function LearningAlerts({ students, onWorkshops, onStudents, onSupport }: { students: Candidate[]; onWorkshops: () => void; onStudents: () => void; onSupport: (student: Candidate) => void }) {
  const sorted = [...students].sort((a, b) => a.average - b.average)
  const support = sorted.filter(student => student.gradeCount > 0 && student.level === 'LOW')
  const insufficient = sorted.filter(student => student.gradeCount === 0)
  return <>
    <PageHeading eyebrow="SEGUIMIENTO ACADÉMICO" title="Alertas de aprendizaje" description="Una lectura rápida y explicable de las notas disponibles. Las alertas orientan al docente; no reemplazan su criterio." action={<div className="alert-page-actions"><button className="button button-outline" onClick={() => downloadLearningReport(students)} disabled={!students.length}><Download size={15} /> Descargar reporte</button><button className="button button-dark" onClick={onWorkshops}><Sparkles size={16} /> Preparar refuerzo</button></div>} />
    <div className="info-banner"><Activity size={18} /><div><strong>Análisis inmediato, sin esperar a la IA</strong><p>El nivel se calcula con el promedio de notas importadas. Cuando aún no hay notas, la aplicación lo indica en vez de inventar un diagnóstico.</p></div></div>
    <div className="alert-summary-grid"><article className="panel alert-summary-card alert-summary-urgent"><span className="alert-summary-icon"><AlertTriangle size={20} /></span><div><strong>{support.length}</strong><span>En refuerzo</span></div><small>Promedio menor a 3.0</small></article><article className="panel alert-summary-card alert-summary-watch"><span className="alert-summary-icon"><Activity size={20} /></span><div><strong>{sorted.filter(student => student.gradeCount > 0 && student.level === 'MEDIUM').length}</strong><span>En seguimiento</span></div><small>Promedio de 3.0 a menos de 4.0</small></article><article className="panel alert-summary-card alert-summary-data"><span className="alert-summary-icon"><Database size={20} /></span><div><strong>{insufficient.length}</strong><span>Sin notas cargadas</span></div><small>Se necesita más información</small></article></div>
    <section className="panel learning-alert-list"><div className="panel-heading"><div><div className="eyebrow">PRIORIZACIÓN TRANSPARENTE</div><h2>Estudiantes para revisar</h2></div><button className="text-button" onClick={onStudents}>Ver todas las notas <ArrowRight size={14} /></button></div>
      {sorted.length ? <div className="learning-alert-rows">{sorted.map(student => {
        const noGrades = student.gradeCount === 0
        const urgency = noGrades ? 'Sin datos suficientes' : student.level === 'LOW' ? 'Atención prioritaria' : student.level === 'MEDIUM' ? 'Dar seguimiento' : 'Buen progreso'
        const reason = noGrades ? 'Aún no hay notas importadas para este estudiante.' : student.level === 'LOW' ? `Promedio ${student.average.toFixed(1)} en ${student.gradeCount} nota(s); conviene revisar los temas con mayor dificultad.` : student.level === 'MEDIUM' ? `Promedio ${student.average.toFixed(1)}; revisar próximas entregas para detectar cambios.` : `Promedio ${student.average.toFixed(1)}; mantener el seguimiento y proponer retos.`
        return <article className={`learning-alert-row ${noGrades ? 'alert-no-data' : `alert-${student.level.toLowerCase()}`}`} key={student.id}><Avatar name={student.name} /><div className="learning-alert-main"><div><strong>{student.name}</strong><span className={`alert-priority ${noGrades ? 'priority-neutral' : `priority-${student.level.toLowerCase()}`}`}>{urgency}</span></div><p>{reason}</p><small>{student.email || `Estudiante #${student.id}`}</small></div><div className="learning-alert-grade">{noGrades ? '—' : student.average.toFixed(1)}<small>{noGrades ? 'sin notas' : '/ 5.0'}</small></div><button className="button button-outline student-support-button" onClick={() => onSupport(student)}>Ver recomendación <ArrowRight size={14}/></button></article>
      })}</div> : <EmptyState icon={<GraduationCap size={22} />} title="Todavía no hay estudiantes" text="Carga una lista de estudiantes y sus notas para empezar el seguimiento." action={<button className="button button-outline" onClick={onStudents}>Abrir estudiantes</button>} />}
    </section>
  </>
}

function StudentSupportDialog({ student, grades, onClose, onGenerate }: { student: Candidate; grades: Grade[]; onClose: () => void; onGenerate: (mode: SupportMode) => void }) {
  const advice = student.gradeCount === 0
    ? 'Aún no hay notas para identificar una dificultad concreta. Puedes preparar una actividad preventiva y cargar una evaluación para hacer seguimiento.'
    : student.level === 'LOW'
      ? 'Conviene retomar los conceptos base con ejemplos resueltos, práctica guiada y una comprobación corta al final.'
      : student.level === 'MEDIUM'
        ? 'Está avanzando, pero puede consolidar lo aprendido con ejercicios de aplicación y una pregunta de transferencia.'
        : 'Muestra buen progreso. Puedes proponer un reto de profundización y pedirle que explique su estrategia.'
  return <Modal onClose={onClose} title="Acompañamiento del estudiante" className="student-support-modal"><div className="student-support-detail"><div className="student-support-person"><Avatar name={student.name}/><div><strong>{student.name}</strong><span>{student.gradeCount ? `${student.average.toFixed(1)} / 5 · ${student.gradeCount} notas` : 'Todavía no hay notas registradas'}</span></div><span className={`level-badge level-${student.level.toLowerCase()}`}>{formatLevel(student.level)}</span></div><div className="student-support-advice"><span className="eyebrow">RECOMENDACIÓN PARA REVISAR</span><p>{advice}</p></div>{grades.length > 0 && <div className="student-support-grades"><strong>Notas del curso</strong>{grades.slice(-5).reverse().map((grade, index) => <div key={`${grade.subjectId}-${grade.period}-${index}`}><span>{grade.period || `Evaluación ${grade.id}`}</span><b>{Number(grade.grade).toFixed(1)}</b></div>)}</div>}<div className="student-support-actions"><button className="button button-outline" onClick={() => onGenerate('quiz')}><CheckCircle2 size={16}/> Preparar quiz</button><button className="button button-dark" onClick={() => onGenerate('workshop')}><Sparkles size={15}/> Generar taller de apoyo</button></div></div></Modal>
}

function downloadLearningReport(students: Candidate[]) {
  const columns = ['Estudiante', 'Correo', 'Promedio', 'Cantidad de notas', 'Estado', 'Observacion']
  const rows = students.map(student => {
    const status = student.gradeCount === 0 ? 'Sin datos suficientes' : student.level === 'LOW' ? 'En refuerzo' : student.level === 'MEDIUM' ? 'En seguimiento' : 'Progreso adecuado'
    const reason = student.gradeCount === 0 ? 'No tiene notas importadas' : student.level === 'LOW' ? `Promedio menor a 3.0 en ${student.gradeCount} nota(s)` : student.level === 'MEDIUM' ? `Promedio entre 3.0 y menos de 4.0 en ${student.gradeCount} nota(s)` : `Promedio de 4.0 o superior en ${student.gradeCount} nota(s)`
    return [student.name, student.email || '', student.gradeCount ? student.average.toFixed(2) : '', String(student.gradeCount), status, reason]
  })
  const csv = [columns, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  downloadFile(`reporte-aprendizaje-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
}

function MetricCard({ icon, label, value, note, tone, onClick }: { icon: ReactNode; label: string; value: string | number; note: string; tone: string; onClick: () => void }) {
  return <button className="metric-card" onClick={onClick}><div className="metric-top"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><ArrowUpRight size={15} className="metric-arrow" /></div><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></button>
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><strong>{title}</strong><p>{text}</p>{action}</div>
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const color = ['avatar-mint', 'avatar-lilac', 'avatar-peach', 'avatar-blue'][name.charCodeAt(0) % 4]
  return <span className={`student-avatar ${color} ${small ? 'avatar-small' : ''}`}>{initials(name)}</span>
}

function StudentsPage({ students, courseId, query, setQuery, busy, onCreate, onEdit, onRefresh, onSupport, notify }: { students: Candidate[]; courseId: number | null; query: string; setQuery: (query: string) => void; busy: boolean; onCreate: () => void; onEdit: (student: Student) => void; onRefresh: () => void; onSupport: (student: Candidate) => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [filter, setFilter] = useState<'ALL' | AcademicLevel>('ALL')
  const [importing, setImporting] = useState(false)
  const [importingRoster, setImportingRoster] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const filtered = students.filter(student => (filter === 'ALL' || student.level === filter) && `${student.name} ${student.email || ''}`.toLowerCase().includes(query.toLowerCase()))
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!courseId) return notify('Selecciona un curso antes de importar notas.', 'error')
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return notify('El archivo debe ser CSV o Excel (.xlsx, .xls).', 'error')
    setImporting(true)
    try {
      const csvFile = await spreadsheetFileAsCsv(file, 'grades')
      const form = new FormData(); form.append('file', csvFile)
      const imported = await request<Grade[]>(`/api/grades/import?courseId=${courseId}`, { method: 'POST', body: form })
      notify(`Se importaron ${imported.length} registros de notas.`)
      onRefresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo importar el archivo.', 'error') }
    finally { setImporting(false) }
  }
  const importRoster = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!courseId) return notify('Selecciona un curso antes de importar estudiantes.', 'error')
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return notify('La lista debe ser CSV o Excel (.xlsx, .xls).', 'error')
    setImportingRoster(true)
    try {
      const csvFile = await spreadsheetFileAsCsv(file, 'roster')
      const form = new FormData(); form.append('file', csvFile)
      const imported = await request<Student[]>(`/api/students/import?courseId=${courseId}`, { method: 'POST', body: form })
      notify(`Se cargaron ${imported.length} estudiante(s) en este curso.`)
      onRefresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo importar la lista.', 'error') }
    finally { setImportingRoster(false) }
  }
  const deleteStudent = async (student: Student) => {
    if (!window.confirm(`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`)) return
    setDeleting(student.id)
    try { await request<void>(`/api/students/${student.id}`, { method: 'DELETE' }); notify('Estudiante eliminado.'); onRefresh() }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error') }
    finally { setDeleting(null) }
  }
  return <>
    <PageHeading eyebrow="TU COMUNIDAD" title="Estudiantes" description="Importa la lista y el Excel de notas de este curso. FairTeam calcula los niveles y te ayuda a priorizar el refuerzo." action={<><label className={`button button-outline upload-button ${importingRoster ? 'is-loading' : ''}`}><input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={importRoster} disabled={importingRoster || !courseId} />{importingRoster ? <LoaderCircle size={16} className="spin" /> : <Users size={16} />}{importingRoster ? 'Importando…' : 'Importar lista Excel'}</label><label className={`button button-outline upload-button ${importing ? 'is-loading' : ''}`}><input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={importFile} disabled={importing || !courseId} />{importing ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}{importing ? 'Importando…' : 'Importar notas Excel'}</label><button className="button button-dark" onClick={onCreate} disabled={!courseId}><Plus size={16} /> Agregar estudiante</button></>} />
    <section className="panel directory-panel"><div className="directory-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o correo…" /></div><div className="filter-control"><Filter size={16} /><select value={filter} onChange={event => setFilter(event.target.value as 'ALL' | AcademicLevel)} aria-label="Filtrar por nivel"><option value="ALL">Todos los niveles</option><option value="LOW">En refuerzo</option><option value="MEDIUM">En proceso</option><option value="HIGH">Avanzado</option></select><ChevronDown size={14} /></div><button className="icon-button small-icon" onClick={onRefresh} aria-label="Actualizar lista"><Activity size={16} /></button></div>
      <div className="table-wrap"><table className="student-table"><thead><tr><th>ESTUDIANTE</th><th>NIVEL ACTUAL</th><th>PROMEDIO</th><th>PROGRESO</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filtered.map(student => <tr key={student.id}><td><div className="student-cell"><Avatar name={student.name} /><span><strong>{student.name}</strong><small>{student.email || `ID ${student.id}`}</small></span></div></td><td><span className={`level-badge level-${student.level.toLowerCase()}`}><i />{formatLevel(student.level)}</span></td><td>{student.gradeCount > 0 ? <><strong className="grade-number">{student.average.toFixed(1)}</strong><span className="grade-total"> / 5.0</span></> : <span className="grade-total">Sin notas</span>}</td><td><div className="progress-cell"><div className="progress-track"><i style={{ width: `${Math.min(100, (student.gradeCount > 0 ? student.average : 0) / 5 * 100)}%` }} /></div><small>{student.gradeCount > 0 ? `${Math.round(student.average / 5 * 100)}%` : "—"}</small></div></td><td><div className="row-actions"><button className="button button-outline student-support-button" onClick={() => onSupport(student)}>Seguimiento</button><button className="icon-button small-icon" onClick={() => onEdit(student)} aria-label={`Editar ${student.name}`}><MoreHorizontal size={17} /></button><button className="icon-button small-icon danger-hover" onClick={() => void deleteStudent(student)} disabled={deleting === student.id} aria-label={`Eliminar ${student.name}`}>{deleting === student.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}</button></div></td></tr>)}</tbody></table>
        {busy && <div className="table-loading"><LoaderCircle size={19} className="spin" /> Actualizando estudiantes…</div>}
        {!busy && filtered.length === 0 && <EmptyState icon={<GraduationCap size={22} />} title={students.length ? 'No encontramos coincidencias' : 'Aún no hay estudiantes'} text={students.length ? 'Prueba con otro nombre o cambia el filtro.' : 'Importa el Excel del grupo o agrega estudiantes manualmente para comenzar.'} action={!students.length ? <button className="button button-dark" onClick={onCreate}><Plus size={15} /> Agregar primer estudiante</button> : undefined} />}
      </div><div className="table-footer"><span>Mostrando <b>{filtered.length}</b> de <b>{students.length}</b> estudiantes</span><span className="api-footnote">Niveles calculados con notas importadas; si no hay notas, se usa el nivel del perfil.</span></div>
    </section>
    <div className="info-banner"><FileText size={18} /><div><strong>Excel y CSV, con los títulos que usa el profesor</strong><p>La lista necesita nombre; el correo y nivel son opcionales. Para notas incluye estudiante, materia, nota y periodo. Se reconocen encabezados como Nombre, Correo, Materia, Nota y Periodo. El Excel se lee en este navegador y solo se envían los registros ya convertidos al backend.</p></div><div className="template-actions"><button className="text-button" onClick={() => downloadXlsxTemplate('plantilla-estudiantes-fairteam.xlsx', 'roster')}>Plantilla de lista (.xlsx) <Download size={14} /></button><button className="text-button" onClick={() => downloadXlsxTemplate('plantilla-notas-fairteam.xlsx', 'grades')}>Plantilla de notas (.xlsx) <Download size={14} /></button><button className="text-button" onClick={downloadRosterTemplate}>CSV <Download size={14} /></button><button className="text-button" onClick={downloadGradeTemplate}>CSV notas <Download size={14} /></button></div></div>
  </>
}

function StudentDialog({ student, courseId, onClose, onSaved, notify }: { student: Student | null; courseId: number | null; onClose: () => void; onSaved: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [name, setName] = useState(student?.name || '')
  const [email, setEmail] = useState(student?.email || '')
  const [level, setLevel] = useState(levelOf(student?.academicLevel))
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      await request<Student>(student ? `/api/students/${student.id}` : '/api/students', {
        method: student ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, academicLevel: level, courseId }),
      })
      notify(student ? 'Perfil actualizado.' : 'Estudiante agregado.')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el perfil.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal onClose={onClose} title={student ? 'Editar estudiante' : 'Agregar estudiante'}><form className="form-stack" onSubmit={submit}><label>Nombre completo<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Valentina Rojas" /></label><label>Correo electrónico <span className="optional-label">Opcional</span><input type="email" maxLength={180} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@institucion.edu.co" /></label><label>Nivel inicial<select value={level} disabled={Boolean(student)} onChange={event => setLevel(event.target.value as AcademicLevel)}><option value="LOW">En refuerzo</option><option value="MEDIUM">En proceso</option><option value="HIGH">Avanzado</option></select></label>{student && <div className="form-note"><Lightbulb size={15} /> El backend permite editar nombre y correo. El nivel se calcula con las notas importadas y por eso no se puede cambiar aquí.</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button button-dark" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Guardando…' : 'Guardar estudiante'}</button></div></form></Modal>
}

function Modal({ children, onClose, title, className = '' }: { children: ReactNode; onClose: () => void; title: string; className?: string }) {
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener) }, [onClose])
  return <div className={`modal-backdrop ${className}-backdrop`} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className={`modal-card ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><div className="eyebrow">FAIRTEAM</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>{children}</section></div>
}

function ProjectsPage({ projects, teams, onRefresh, onManageTeams, notify }: { projects: Project[]; teams: Team[]; onRefresh: () => void; onManageTeams: (projectId: number) => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [dialog, setDialog] = useState<Project | null | false>(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const create = () => setDialog(null)
  const edit = (project: Project) => setDialog(project)
  const remove = async (project: Project) => {
    const projectTeams = teams.filter(team => Number(team.project?.id) === Number(project.id)).length
    const warning = projectTeams ? ` Este proyecto tiene ${projectTeams} equipo(s); si la base de datos los protege, tendrás que eliminarlos primero.` : ''
    if (!window.confirm(`¿Eliminar el proyecto “${project.name}”?${warning}`)) return
    setDeleting(project.id)
    try {
      await request<void>(`/api/projects/${project.id}`, { method: 'DELETE' })
      notify('Proyecto eliminado.')
      onRefresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar el proyecto.', 'error') }
    finally { setDeleting(null) }
  }
  return <>
    <PageHeading eyebrow="ORGANIZA EL TRABAJO" title="Proyectos" description="Crea espacios de trabajo, define el tamaño de los equipos y organiza a tus estudiantes." action={<button className="button button-dark" onClick={create}><Plus size={16} /> Nuevo proyecto</button>} />
    {projects.length ? <div className="projects-grid">{projects.map(project => {
      const projectTeams = teams.filter(team => Number(team.project?.id) === Number(project.id))
      return <article className="panel project-card" key={project.id}><div className="project-card-top"><span className="project-icon"><FolderKanban size={20} /></span><span className="project-card-id">PROYECTO #{project.id}</span><button className="icon-button small-icon project-edit-button" onClick={() => edit(project)} aria-label={`Editar ${project.name}`} title="Editar proyecto"><MoreHorizontal size={18} /></button></div><h2>{project.name}</h2><p className="project-description">{project.description || 'Sin descripción. Edita el proyecto para agregar objetivos y contexto.'}</p><div className="project-meta"><span><Users size={14} /> Equipos <b>{projectTeams.length}</b></span><span><Grid2X2 size={14} /> {project.teamSize || 3} personas por equipo</span></div><div className="project-card-actions"><button className="button button-dark" onClick={() => onManageTeams(project.id)}><Users size={15} /> Organizar equipos <ArrowRight size={14} /></button><button className="icon-button small-icon danger-hover" onClick={() => void remove(project)} disabled={deleting === project.id} aria-label={`Eliminar ${project.name}`} title="Eliminar proyecto">{deleting === project.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}</button></div></article>
    })}</div> : <section className="panel projects-empty-panel"><EmptyState icon={<FolderKanban size={23} />} title="Crea el primer proyecto" text="Cada proyecto reúne a sus equipos y define cuántas personas pueden participar en cada uno." action={<button className="button button-dark" onClick={create}><Plus size={15} /> Crear proyecto</button>} /></section>}
    {dialog !== false && <ProjectDialog project={dialog} onClose={() => setDialog(false)} onSaved={() => { setDialog(false); onRefresh() }} notify={notify} />}
  </>
}

function ProjectDialog({ project, onClose, onSaved, notify }: { project: Project | null; onClose: () => void; onSaved: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const savedSize = Number(localStorage.getItem('fairteam.defaultTeamSize'))
  const defaultSize = [2, 3, 4, 5, 6].includes(savedSize) ? savedSize : 3
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [teamSize, setTeamSize] = useState(project?.teamSize || defaultSize)
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await request<Project>(project ? `/api/projects/${project.id}` : '/api/projects', {
        method: project ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), teamSize }),
      })
      notify(project ? 'Proyecto actualizado.' : 'Proyecto creado.')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el proyecto.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal onClose={onClose} title={project ? 'Editar proyecto' : 'Crear proyecto'}><form className="form-stack" onSubmit={submit}><label>Nombre del proyecto<input required maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Laboratorio de ideas" /></label><label>Descripción <span className="optional-label">Opcional</span><textarea rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Objetivos, asignatura o contexto del proyecto…" /></label><label>Personas por equipo<select value={teamSize} disabled={Boolean(project)} onChange={event => setTeamSize(Number(event.target.value))}>{[2, 3, 4, 5, 6].map(size => <option key={size} value={size}>{size} personas</option>)}</select></label>{project && <div className="form-note"><Lightbulb size={15} /> El tamaño se define al crear el proyecto y no se puede cambiar desde este formulario.</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button button-dark" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Guardando…' : project ? 'Guardar cambios' : 'Crear proyecto'}</button></div></form></Modal>
}

function TeamsPage({ students, projects, teams, initialProjectId, onRefresh, notify }: { students: Candidate[]; projects: Project[]; teams: Team[]; initialProjectId: string | null; onRefresh: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const defaultTeamSize = Number(localStorage.getItem('fairteam.defaultTeamSize'))
  const validDefaultTeamSize = [2, 3, 4, 5, 6].includes(defaultTeamSize) ? defaultTeamSize : 3
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [teamSize, setTeamSize] = useState(validDefaultTeamSize)
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('Proyecto colaborativo')
  const [drafts, setDrafts] = useState<TeamDraft[]>([])
  const [working, setWorking] = useState(false)
  const [projectModal, setProjectModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', teamSize: validDefaultTeamSize })
  const [savingProject, setSavingProject] = useState(false)
  useEffect(() => { setSelectedIds(students.map(student => student.id)) }, [students])
  useEffect(() => { if (projects.length && !projectId) { setProjectId(String(projects[0].id)); setTeamSize(projects[0].teamSize || 3); setProjectName(projects[0].name) } }, [projects, projectId])
  useEffect(() => { const project = projects.find(item => String(item.id) === initialProjectId); if (project) { setProjectId(String(project.id)); setTeamSize(project.teamSize || 3); setProjectName(project.name) } }, [initialProjectId, projects])
  const selected = students.filter(student => selectedIds.includes(student.id))
  const toggleStudent = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const pickProject = (id: string) => { setProjectId(id); const project = projects.find(item => String(item.id) === id); if (project) { setTeamSize(project.teamSize || 3); setProjectName(project.name) } }

  const makeTeams = async () => {
    if (selected.length < 2) return notify('Selecciona al menos dos estudiantes para armar equipos.', 'error')
    setWorking(true)
    try {
      const sorted = [...selected].sort((a, b) => b.average - a.average)
      const groupCount = Math.ceil(sorted.length / teamSize)
      const groups = Array.from({ length: groupCount }, (_, index) => ({ name: `Equipo ${String(index + 1).padStart(2, '0')}`, members: [] as Candidate[], scoreTotal: 0 }))
      sorted.forEach(student => {
        const available = groups.filter(group => group.members.length < teamSize)
        available.sort((a, b) => a.scoreTotal - b.scoreTotal || a.members.length - b.members.length)
        const destination = available[0]
        destination.members.push(student); destination.scoreTotal += student.average
      })
      const analyzed = await Promise.all(groups.map(async group => {
        try {
          const result = await request<{ score: number; explanation: string }>(`/api/teams/analyze?strategy=balanced`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(group.members.map(member => ({ studentId: member.id, academicScore: member.average, skillScore: 50, availabilityScore: 50 }))),
          })
          return { name: group.name, members: group.members, score: estimateBalance(group.members), explanation: result.explanation }
        } catch { return { name: group.name, members: group.members, score: estimateBalance(group.members), explanation: 'Propuesta equilibrada por nivel académico; análisis del backend no disponible.' } }
      }))
      setDrafts(analyzed)
      notify(`Se propusieron ${analyzed.length} equipos para ${selected.length} estudiantes.`)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudieron crear las propuestas.', 'error') }
    finally { setWorking(false) }
  }

  const createProject = async (event: FormEvent) => {
    event.preventDefault(); setSavingProject(true)
    try {
      const created = await request<Project>('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProject.name.trim(), description: newProject.description.trim(), teamSize: Number(newProject.teamSize) }) })
      notify('Proyecto creado.'); setProjectModal(false); setNewProject({ name: '', description: '', teamSize: validDefaultTeamSize }); setProjectId(String(created.id)); setProjectName(created.name); setTeamSize(created.teamSize || validDefaultTeamSize); await onRefresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo crear el proyecto.', 'error') }
    finally { setSavingProject(false) }
  }

  const saveTeams = async () => {
    if (!drafts.length) return
    if (!projectId) return notify('Crea o selecciona un proyecto antes de guardar equipos.', 'error')
    setWorking(true)
    let saved = 0
    try {
      for (const draft of drafts) {
        const team = await request<Team>('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${projectName} · ${draft.name}`, project: { id: Number(projectId) }, formationStrategy: 'balanced', score: draft.score ?? null, explanation: draft.explanation ?? 'Propuesta equilibrada por nivel académico.' }) })
        for (const member of draft.members) {
          await request('/api/team-students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: { teamId: team.id, studentId: member.id }, team: { id: team.id }, student: { id: member.id } }) })
        }
        saved++
      }
      setDrafts([]); notify(`Se guardaron ${saved} equipos con sus integrantes.`); onRefresh()
    } catch (error) { notify(`Se guardaron ${saved} equipo(s) antes de encontrar un error. ${error instanceof Error ? error.message : ''}`, 'error'); onRefresh() }
    finally { setWorking(false) }
  }

  return <>
    <PageHeading eyebrow="COLABORACIÓN CON PROPÓSITO" title="Equipos equilibrados" description="Combina distintos niveles para que cada integrante pueda aportar y aprender de los demás." action={<button className="button button-outline" onClick={() => setProjectModal(true)}><Plus size={16} /> Nuevo proyecto</button>} />
    <div className="team-builder-layout"><section className="panel team-setup"><div className="panel-heading"><div><div className="eyebrow">1 · DEFINE TU GRUPO</div><h2>¿A quiénes vamos a reunir?</h2></div><span className="soft-icon mint-icon"><Users size={18} /></span></div><label className="field-label">Proyecto<select value={projectId} onChange={event => pickProject(event.target.value)}><option value="">Selecciona un proyecto…</option>{projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><div className="field-row"><label className="field-label">Estudiantes seleccionados <small>{selected.length} de {students.length}</small></label><button className="text-button" onClick={() => setSelectedIds(selected.length === students.length ? [] : students.map(student => student.id))}>{selected.length === students.length ? 'Quitar todos' : 'Seleccionar todos'}</button></div><div className="select-students">{students.length ? students.map(student => <label className={`select-student ${selectedIds.includes(student.id) ? 'selected' : ''}`} key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><Avatar name={student.name} small /><span className="select-student-name"><b>{student.name}</b><small>{student.average.toFixed(1)} / 5.0</small></span><span className={`level-dot level-${student.level.toLowerCase()}`} /></label>) : <div className="select-empty">Primero agrega estudiantes para crear propuestas.</div>}</div><div className="team-size-control"><div><b>Integrantes por equipo</b><span>El último equipo puede tener menos personas.</span></div><select value={teamSize} onChange={event => setTeamSize(Number(event.target.value))}>{[2, 3, 4, 5, 6].map(size => <option key={size} value={size}>{size} personas</option>)}</select></div><div className="balance-note"><Sparkles size={17} /><span><b>Equilibrio por fortalezas</b><small>Distribuye niveles académicos para crear grupos diversos. Luego el backend analiza cada propuesta.</small></span></div><button className="button button-dark full-button" onClick={() => void makeTeams()} disabled={working || students.length < 2}>{working ? <LoaderCircle size={16} className="spin" /> : <WandSparkles size={16} />}{working ? 'Preparando equipos…' : 'Proponer equipos'}<ArrowRight size={15} /></button></section>
      <section className="panel team-results"><div className="panel-heading"><div><div className="eyebrow">2 · REVISA LA PROPUESTA</div><h2>Una mezcla que suma</h2></div><span className="soft-icon lilac-icon"><Trophy size={18} /></span></div>{drafts.length ? <><p className="panel-copy">Revisa integrantes y nivel de equilibrio. Puedes volver a proponer cuando quieras.</p><div className="draft-team-list">{drafts.map(draft => <article className="draft-team" key={draft.name}><div className="draft-team-head"><div className="team-number">{draft.name.replace('Equipo ', '')}</div><div className="draft-team-title"><strong>{draft.name}</strong><span>{draft.members.length} integrantes · {draft.score != null ? `${Math.round(draft.score)}% equilibrio estimado` : 'análisis local'}</span></div><span className="balance-meter"><i style={{ width: `${Math.max(6, Math.min(100, draft.score || 70))}%` }} /></span></div><div className="team-member-chips">{draft.members.map(member => <div className="member-chip" key={member.id}><Avatar name={member.name} small /><span>{member.name}</span><i className={`level-dot level-${member.level.toLowerCase()}`} /></div>)}</div><div className="team-mix"><span className="mix-label">Mezcla del grupo</span>{(['LOW', 'MEDIUM', 'HIGH'] as AcademicLevel[]).map(level => { const count = draft.members.filter(member => member.level === level).length; return count ? <span key={level} className={`mix-chip mix-${level.toLowerCase()}`}>{count} {formatLevel(level).toLowerCase()}</span> : null })}</div></article>)}</div><button className="button button-green full-button" onClick={() => void saveTeams()} disabled={working || !projectId}>{working ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{working ? 'Guardando…' : 'Guardar equipos en el proyecto'}</button>{!projectId && <p className="inline-warning">Selecciona o crea un proyecto para guardar estos equipos.</p>}</> : <EmptyState icon={<Users size={23} />} title="Los equipos empiezan con una buena mezcla" text="Selecciona tu proyecto, el tamaño del grupo y a las personas que participarán. FairTeam propone una distribución equilibrada para que la revises." action={<div className="empty-steps"><span><i>1</i> Selecciona</span><ArrowRight size={14} /><span><i>2</i> Propón</span><ArrowRight size={14} /><span><i>3</i> Ajusta</span></div>} />}</section></div>
    <div className="info-banner team-note"><Lightbulb size={18} /><div><strong>El docente siempre tiene la última palabra</strong><p>Las propuestas son apoyo para tomar decisiones. Puedes modificar la selección y volver a generar antes de guardar.</p></div></div>
    <section className="panel saved-teams-panel"><div className="panel-heading"><div><div className="eyebrow">HISTORIAL</div><h2>Equipos guardados</h2></div><span className="saved-count">{teams.length}</span></div>{teams.length ? <div className="saved-team-grid">{teams.map(team => <div className="saved-team-card" key={team.id}><span className="shortcut-icon mint-icon"><Users size={17} /></span><div><b>{team.name}</b><small>{team.project?.name || 'Proyecto'} · {team.formationStrategy || 'equilibrado'}</small></div><span className="score-pill">{Math.round(Number(team.score || 0))}%</span></div>)}</div> : <p className="saved-empty">Todavía no hay equipos guardados. Genera una propuesta y guárdala en un proyecto.</p>}</section>
    {projectModal && <Modal onClose={() => setProjectModal(false)} title="Crear proyecto"><form className="form-stack" onSubmit={createProject}><label>Nombre del proyecto<input required maxLength={150} value={newProject.name} onChange={event => setNewProject({ ...newProject, name: event.target.value })} placeholder="Ej. Laboratorio de ideas" /></label><label>Descripción <span className="optional-label">Opcional</span><textarea rows={3} value={newProject.description} onChange={event => setNewProject({ ...newProject, description: event.target.value })} placeholder="¿Qué van a construir juntos?" /></label><label>Personas por equipo<select value={newProject.teamSize} onChange={event => setNewProject({ ...newProject, teamSize: Number(event.target.value) })}>{[2, 3, 4, 5, 6].map(size => <option key={size} value={size}>{size} personas</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setProjectModal(false)}>Cancelar</button><button className="button button-dark" disabled={savingProject}>{savingProject && <LoaderCircle size={15} className="spin" />}{savingProject ? 'Creando…' : 'Crear proyecto'}</button></div></form></Modal>}
  </>
}

function WorkshopsPage({ saved, result, course, supportTarget, onSupportComplete, summary, onGenerate, onSelect, notify }: {
  saved: GeneratedWorkshop[]; result: GeneratedWorkshop | null; course: Course | null
  supportTarget: SupportTarget | null; onSupportComplete: () => void
  summary: { students: number; graded: number; low: number; medium: number; high: number; average: number | null }
  onGenerate: (workshop: GeneratedWorkshop) => void; onSelect: (workshop: GeneratedWorkshop | null) => void
  notify: (message: string, kind?: Toast['kind']) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null)
  const [materialsLoading, setMaterialsLoading] = useState(true)
  const [uploadingMaterial, setUploadingMaterial] = useState(false)
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<AcademicLevel>('LOW')
  const [objective, setObjective] = useState('')
  const [generating, setGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const autoStarted = useRef<string | null>(null)

  useEffect(() => {
    if (!course) { setMaterials([]); setMaterialsLoading(false); return }
    setSubject(course.name)
    let active = true
    setMaterialsLoading(true)
    void request<CourseMaterial[]>(`/api/courses/${course.id}/materials`).then(items => {
      if (active) setMaterials(items)
    }).catch(() => { if (active) setMaterials([]) }).finally(() => { if (active) setMaterialsLoading(false) })
    return () => { active = false }
  }, [course?.id])

  useEffect(() => {
    if (!supportTarget || materialsLoading || !course || generating) return
    const { student, mode } = supportTarget
    const matchingSaved = saved.find(item => item.targetStudentId === student.id && item.supportType === mode)
    if (matchingSaved) { onSelect(matchingSaved); onSupportComplete(); return }
    if (!materials.length) return
    const latest = [...materials].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0]
    const key = `${course.id}:${student.id}:${latest.id}:${mode}`
    if (autoStarted.current === key) return
    autoStarted.current = key
    setSelectedMaterialId(latest.id)
    setSubject(course.name)
    const topicText = mode === 'quiz' ? 'Quiz breve sobre conceptos clave del material' : 'Refuerzo de conceptos clave del material de clase'
    const goal = mode === 'quiz'
      ? `Crea un quiz corto de comprobación sobre el material: exactamente 3 preguntas claras, adecuadas para nivel ${formatLevel(student.level)}, con opciones, respuesta correcta y explicación breve. Evalúa comprensión y aplicación, no memoria aislada.`
      : student.level === 'LOW'
      ? 'Comprender los conceptos fundamentales mediante ejemplos guiados y demostrar lo aprendido con una comprobación breve.'
      : student.level === 'MEDIUM'
        ? 'Consolidar los conceptos del material y aplicarlos en ejercicios de dificultad gradual.'
        : 'Profundizar en los conceptos del material y resolver un reto de aplicación.'
    setTopic(topicText); setLevel(student.level); setObjective(goal)
    void generateWorkshop({ materialId: latest.id, topic: topicText, objective: goal, subject: course.name, target: student, mode })
  }, [supportTarget, materialsLoading, materials, course?.id, generating, saved])

  const selectFile = (candidate?: File) => {
    if (!candidate) return
    if (!/\.(pdf|docx|txt)$/i.test(candidate.name)) return notify('Adjunta material en PDF, DOCX o TXT.', 'error')
    if (candidate.size > 10 * 1024 * 1024) return notify('El archivo supera el límite de 10 MB.', 'error')
    setFile(candidate)
    setSelectedMaterialId(null)
    setErrorMessage('')
  }

  const uploadMaterial = async () => {
    if (!course || !file) return null
    setUploadingMaterial(true)
    try {
      const form = new FormData(); form.append('file', file)
      const material = await request<CourseMaterial>(`/api/courses/${course.id}/materials`, { method: 'POST', body: form })
      setMaterials(current => [material, ...current.filter(item => item.id !== material.id)])
      setSelectedMaterialId(material.id)
      setFile(null)
      notify('Material guardado en este curso.')
      return material
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo guardar el material.', 'error')
      return null
    } finally { setUploadingMaterial(false) }
  }

  const removeMaterial = async (material: CourseMaterial) => {
    if (!course) return
    try {
      await request<void>(`/api/courses/${course.id}/materials/${material.id}`, { method: 'DELETE' })
      setMaterials(items => items.filter(item => item.id !== material.id))
      if (selectedMaterialId === material.id) setSelectedMaterialId(null)
      notify('Material eliminado de este curso.')
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar el material.', 'error') }
  }

  const generateWorkshop = async (options: { materialId?: number | null; topic?: string; objective?: string; subject?: string; target?: Candidate; mode?: SupportMode } = {}) => {
    if (!course) return notify('Primero crea o selecciona un curso.', 'error')
    const topicText = (options.topic ?? topic).trim()
    if (!file && !(options.materialId ?? selectedMaterialId)) return notify('Selecciona un material de este curso o adjunta uno nuevo.', 'error')
    if (!topicText) return notify('Escribe el tema que están trabajando en clase.', 'error')
    setGenerating(true)
    setErrorMessage('')
    try {
      const summaryText = summary.average == null
        ? `Curso: ${course.name}. Todavía no hay notas para analizar; el docente solicita una actividad preventiva.`
        : options.target
          ? `Curso: ${course.name}. Propuesta individual para un estudiante clasificado como ${formatLevel(options.target.level)} por su promedio local. Adapta la práctica a este nivel. No se proporcionan identidad ni notas individuales. Tema: ${topicText}.`
          : `Curso: ${course.name}. ${summary.graded} estudiante(s) con notas, ${summary.low} en refuerzo, ${summary.medium} en proceso y ${summary.high} con progreso adecuado. Promedio general: ${summary.average.toFixed(2)} sobre 5. Tema priorizado por el docente: ${topicText}.`
      let materialId = options.materialId ?? selectedMaterialId
      if (file) {
        const uploaded = await uploadMaterial()
        if (!uploaded) throw new Error('No pudimos guardar el material para este curso.')
        materialId = uploaded.id
      }
      if (!materialId) throw new Error('Selecciona o guarda un material para continuar.')
      const form = new FormData()
      form.append('subject', (options.subject ?? subject).trim())
      form.append('targetLevel', level)
      form.append('learningObjective', (options.objective ?? objective).trim() || `Reforzar ${topicText} con actividades prácticas y comprobar la comprensión.`)
      form.append('learningContext', summaryText)
      form.append('generationType', options.mode ?? 'WORKSHOP')
      const response = await request<GeneratedWorkshop>(`/api/courses/${course.id}/materials/${materialId}/generate-workshop`, { method: 'POST', body: form })
      onGenerate(options.target ? {
        ...response,
        ...(options.mode === 'quiz' ? {
          title: `Quiz breve · ${response.subject}`,
          summary: `Quiz de comprobación basado en el material de ${response.subject}. Responde las preguntas y revisa la clave docente después del intento.`,
        } : {}),
        targetStudentId: options.target.id,
        supportType: options.mode ?? 'workshop',
      } : response)
      if (options.target) onSupportComplete()
      notify(options.target ? 'Taller de apoyo generado y guardado para este seguimiento.' : 'Taller generado. Revísalo y ajústalo antes de usarlo.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos generar el taller.'
      setErrorMessage(message)
      notify(message, 'error')
    } finally { setGenerating(false) }
  }

  const generate = (event: FormEvent) => { event.preventDefault(); void generateWorkshop() }

  const copy = async () => {
    if (!result) return
    const text = `${result.title}\n${result.summary}\n\nOBJETIVOS\n${result.learningObjectives.map(item => `• ${item}`).join('\n')}\n\nACTIVIDADES\n${result.activities.map((item, index) => `${index + 1}. ${item.title} (${item.estimatedMinutes} min)\n${item.instructions}`).join('\n\n')}\n\nEVALUACIÓN\n${result.assessment.map((item, index) => `${index + 1}. ${item.question}\n${item.options.map(option => `- ${option}`).join('\n')}\nRespuesta: ${item.correctAnswer}\n${item.explanation}`).join('\n\n')}\n\nReferencias: ${result.sourceReferences.join(', ')}`
    try { await navigator.clipboard.writeText(text); notify('Contenido copiado al portapapeles.') }
    catch { notify('No se pudo copiar el contenido.', 'error') }
  }

  return <>
    <section className="assistant-workshop-hero"><div className="assistant-workshop-copy"><div className="eyebrow">FAIRTEAM <span>·</span> ASISTENTE DEL CURSO</div><h1>De tu material,<br/><span>a una clase que enseña.</span></h1><p>Prepara una actividad basada en lo que enseñas en <b>{course?.name || 'tu curso'}</b>. FairTeam propone; tú revisas y eliges cómo compartirla.</p><div className="workshop-hero-note"><ShieldCheck size={16}/><span>El material y las notas se mantienen en el espacio de este curso.</span></div></div><div className="assistant-workshop-art" aria-hidden="true"><div className="assistant-art-ring ring-a"/><div className="assistant-art-ring ring-b"/><div className="assistant-art-paper"><div className="paper-topline"><i/><i/><i/></div><BookOpen size={34}/><span/><span/><span/></div><div className="assistant-art-spark"><Sparkles size={18}/></div><div className="assistant-art-check"><Check size={15}/></div><small>OBSERVA · REFUERZA · COMPRUEBA</small></div></section>
    <nav className="workshop-steps" aria-label="Pasos para preparar una actividad"><span className="workshop-step-done"><i>1</i><b>Elige el material</b></span><span className="workshop-step-line"/><span><i>2</i><b>Define el refuerzo</b></span><span className="workshop-step-line"/><span><i>3</i><b>Revisa y descarga</b></span></nav>
    {supportTarget && <div className="student-support-banner"><span className="soft-icon lilac-icon"><Sparkles size={18}/></span><div><strong>{materialsLoading ? 'Buscando material del curso…' : generating ? `Preparando ${supportTarget.mode === 'quiz' ? 'quiz' : 'taller'} · ${formatLevel(supportTarget.student.level)}` : materials.length ? `${supportTarget.mode === 'quiz' ? 'Quiz' : 'Refuerzo'} personalizado · ${formatLevel(supportTarget.student.level)}` : 'Falta material para preparar la propuesta'}</strong><p>{materialsLoading ? 'En cuanto cargue la biblioteca, usaremos el material más reciente.' : materials.length ? 'Se está usando el material más reciente. No se enviaron el nombre ni las notas individuales a Gemini.' : 'Sube y guarda un PDF, DOCX o TXT en la biblioteca; después la propuesta se generará automáticamente.'}</p>{errorMessage && <button className="text-button" onClick={() => void generateWorkshop({ materialId: selectedMaterialId ?? materials[0]?.id, topic, objective, subject, target: supportTarget.student, mode: supportTarget.mode })} disabled={generating}>Reintentar <RotateCw size={13}/></button>}</div><button className="icon-button" onClick={onSupportComplete} aria-label="Cerrar seguimiento"><X size={16}/></button></div>}
    <section className="workshop-course-context">
      <div className="workshop-context-title"><span className="context-mark"><Activity size={18} /></span><div><small>LECTURA DEL CURSO</small><strong>{course?.name || 'Selecciona un curso'}</strong></div></div>
      <div className="context-stat"><strong>{summary.students}</strong><span>estudiantes</span></div>
      <div className="context-stat context-low"><strong>{summary.low}</strong><span>necesitan refuerzo</span></div>
      <div className="context-stat context-medium"><strong>{summary.medium}</strong><span>en proceso</span></div>
      <div className="context-stat context-high"><strong>{summary.high}</strong><span>van avanzando</span></div>
      <div className="context-average"><span>Promedio del curso</span><b>{summary.average == null ? 'Pendiente' : `${summary.average.toFixed(1)} / 5`}</b></div>
      {summary.graded === 0 && <p className="context-no-grades">Carga las notas en Estudiantes para que el asistente pueda priorizar el refuerzo según el desempeño.</p>}
    </section>

    <div className="workshop-layout workshop-layout-new">
      <section className="panel workshop-form-panel workshop-form-new">
        <div className="panel-heading"><div><div className="eyebrow">CREAR ACTIVIDAD</div><h2>¿Qué necesita practicar el grupo?</h2></div><span className="soft-icon lilac-icon"><BrainCircuit size={19} /></span></div>
        <p className="panel-copy">Elige el material y el tema. Recibirás objetivos, instrucciones paso a paso y una comprobación breve, listos para revisar.</p>
        <form className="form-stack" onSubmit={generate}>
          <label>1. Tema de la actividad<input required maxLength={120} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Ej. ciclos, funciones, fotosíntesis…" /></label>
          <label>2. Material de referencia</label>
          <button type="button" className={`dropzone ${file ? 'has-file' : ''}`} onClick={() => uploadRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }}>
            <input ref={uploadRef} type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={event => selectFile(event.target.files?.[0])} />
            {file ? <><span className="dropzone-icon file-selected"><CheckCircle2 size={22} /></span><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · Pendiente de guardar en este curso</small></> : <><span className="dropzone-icon"><Upload size={21} /></span><strong>Arrastra material nuevo aquí</strong><small>PDF, DOCX o TXT · Máximo 10 MB</small></>}
          </button>
          {file && <button type="button" className="button button-outline full-button" onClick={() => void uploadMaterial()} disabled={uploadingMaterial}>{uploadingMaterial ? <LoaderCircle size={15} className="spin"/> : <Upload size={15}/>} {uploadingMaterial ? 'Guardando material…' : 'Guardar en la biblioteca del curso'}</button>}
          <div className="course-material-library"><div className="course-material-heading"><span><FileText size={15}/> BIBLIOTECA DE ESTE CURSO</span><small>{materialsLoading ? 'Cargando…' : `${materials.length} archivos`}</small></div>{materials.length ? <div className="course-material-list">{materials.map(material=><div key={material.id} className={`course-material-row ${selectedMaterialId===material.id?'selected':''}`}><button type="button" className="course-material-select" onClick={()=>{setSelectedMaterialId(material.id);setFile(null)}}><span className="course-material-check">{selectedMaterialId===material.id?<Check size={13}/>:<FileText size={14}/>}</span><span><b>{material.fileName}</b><small>{(material.fileSize/1024).toFixed(0)} KB · guardado en {course?.name}</small></span></button><button type="button" className="course-material-delete" onClick={()=>void removeMaterial(material)} aria-label={`Eliminar ${material.fileName}`}><Trash2 size={14}/></button></div>)}</div> : <p className="course-material-empty">Los archivos que guardes aquí estarán disponibles para crear otros talleres en {course?.name}.</p>}</div>
          <div className="form-row-two"><label>Materia<input required maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ej. Programación" /></label><label>Grupo al que va dirigido<select value={level} onChange={event => setLevel(event.target.value as AcademicLevel)}><option value="LOW">Necesita refuerzo</option><option value="MEDIUM">En proceso</option><option value="HIGH">Progreso adecuado</option></select></label></div>
          <label>¿Qué te gustaría que logren? <span className="optional-label">Opcional</span><textarea rows={2} maxLength={1000} value={objective} onChange={event => setObjective(event.target.value)} placeholder="Ej. Que resuelvan un ciclo y expliquen cuándo termina…" /></label>
          <div className="ai-privacy-note"><ShieldCheck size={15} /><span>Gemini recibe el material y un resumen sin datos personales. Las notas detalladas se quedan en FairTeam.</span></div>
          {errorMessage && <div className="workshop-error" role="alert"><b>No se pudo generar el taller.</b><span>{errorMessage}</span><small>Comprueba el material y vuelve a intentar. El error queda visible aquí.</small></div>}
          <button className="button button-dark full-button generate-button" disabled={generating || !course}>{generating ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{generating ? 'Preparando una propuesta…' : 'Generar taller de refuerzo'}{!generating && <ArrowRight size={15} />}</button>
        </form>
        <div className="generation-hint"><Clock3 size={14} /> Generación optimizada con Gemini rápido. En el plan gratuito, el primer uso puede esperar el arranque del servicio.</div>
      </section>

      <section className="panel workshop-output-panel workshop-output-new">
        <div className="panel-heading"><div><div className="eyebrow">{result ? 'PROPUESTA LISTA PARA REVISAR' : 'AQUÍ VERÁS TU ACTIVIDAD'}</div><h2>{result?.title || 'La guía aparecerá en este espacio'}</h2></div>{result && <button className="button button-outline" onClick={() => downloadWorkshopDocument(result)} title="Descarga una actividad HTML que puedes abrir o imprimir"><ArrowDownToLine size={16} /> Descargar guía</button>}</div>
        {result ? <div className={`workshop-result ${result.supportType === 'quiz' ? 'quiz-result' : ''}`} id="print-workshop">
          <div className="workshop-saved-confirm"><CheckCircle2 size={16}/><span><b>Guardada en Propuestas recientes</b><small>Solo en tu cuenta y en el curso {course?.name || result.subject}.</small></span></div>
          <div className="workshop-meta"><span className="subject-pill">{result.subject}</span><span className={`level-badge level-${levelOf(result.targetLevel).toLowerCase()}`}>{formatLevel(levelOf(result.targetLevel))}</span><span className="duration-pill">{result.supportType === 'quiz' ? <><CheckCircle2 size={13} />{result.assessment.length} preguntas</> : <><Clock3 size={13} />{result.activities.reduce((sum, activity) => sum + activity.estimatedMinutes, 0)} min</>}</span></div>
          <p className="workshop-summary">{result.summary}</p>
          <div className="result-section"><h3><Target size={16} /> ¿Qué van a aprender?</h3><ul className="objective-list">{result.learningObjectives.map((item, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ul></div>
          {result.supportType !== 'quiz' && <div className="result-section"><h3><BookOpen size={16} /> Actividades</h3><div className="activity-cards">{result.activities.map((activity, index) => <article className="workshop-activity" key={`${activity.title}-${index}`}><div className="activity-index">{String(index + 1).padStart(2, '0')}</div><div><div className="activity-title-line"><b>{activity.title}</b><span><Clock3 size={12} />{activity.estimatedMinutes} min</span></div><p>{activity.instructions}</p></div></article>)}</div></div>}
          <div className="result-section"><h3><CheckCircle2 size={16} /> {result.supportType === 'quiz' ? 'Quiz · comprueba lo aprendido' : 'Comprueba si aprendieron'}</h3><div className="assessment-list">{result.assessment.map((item, index) => result.supportType === 'quiz' ? <article className="quiz-question" key={`${item.question}-${index}`}><strong>{index + 1}. {item.question}</strong><ul>{item.options.map((option, optionIndex) => <li key={optionIndex}>{option}</li>)}</ul><details className="quiz-answer-key"><summary>Ver clave docente</summary><p><b>Respuesta:</b> {item.correctAnswer}. {item.explanation}</p></details></article> : <details className="assessment-item" key={`${item.question}-${index}`}><summary><span>{index + 1}</span>{item.question}<ChevronDown size={15} /></summary><div className="assessment-content"><ul>{item.options.map((option, optionIndex) => <li className={option === item.correctAnswer ? 'correct-answer' : ''} key={optionIndex}>{option === item.correctAnswer && <Check size={13} />}{option}</li>)}</ul><p><b>Respuesta sugerida:</b> {item.correctAnswer}. {item.explanation}</p></div></details>)}</div></div>
          <div className="source-note"><FileText size={14} /><span>Material consultado: {result.sourceReferences.join(' · ') || 'Referencias no especificadas'}</span></div>
          <div className="result-actions"><button className="button button-dark" onClick={() => downloadWorkshopDocument(result)}><ArrowDownToLine size={16} /> Descargar para estudiantes</button><button className="button button-outline" onClick={() => window.print()}><FileText size={15} /> Guardar como PDF</button>{result.supportType === 'quiz' && <button className="button button-outline" onClick={() => downloadWorkshopDocument(result, true)}><ShieldCheck size={15} /> Descargar clave docente</button>}<button className="button button-outline" onClick={() => void copy()}><Copy size={15} /> Copiar texto</button></div>
          <p className="download-help"><FileText size={14}/> El archivo para estudiantes no incluye respuestas. Para PDF, elige <b>Guardar como PDF</b> en el diálogo de impresión. La clave docente se descarga por separado cuando es un quiz.</p>
          <p className="review-note"><Lightbulb size={14} /> Es una propuesta para que tú la revises; no cambia las notas ni se asigna automáticamente.</p>
        </div> : <EmptyState icon={<WandSparkles size={24} />} title="Una buena clase empieza con una pregunta" text="Cuando generes la propuesta, verás los objetivos, actividades, evaluación y referencias del material." action={<div className="output-preview"><span><Check size={13} /> Actividades listas para clase</span><span><Check size={13} /> Evaluación breve</span><span><Check size={13} /> Fuente verificable</span></div>} />}
      </section>
    </div>
    <section className="saved-workshops-section"><div className="section-heading"><div><div className="eyebrow">TU BIBLIOTECA</div><h2>Propuestas recientes</h2></div><span className="saved-count">{saved.length}</span></div>{saved.length ? <div className="saved-workshop-grid">{saved.map((workshop, index) => <button className={`saved-workshop-card ${result?.title === workshop.title ? 'selected' : ''}`} key={`${workshop.title}-${index}`} onClick={() => onSelect(workshop)}><span className="shortcut-icon lilac-icon"><BookOpen size={17} /></span><span className="saved-workshop-copy"><b>{workshop.title}</b><small>{workshop.supportType === 'quiz' ? 'Quiz' : 'Taller'} · {workshop.subject} · {workshop.activities.length} actividades</small></span><ChevronRight size={16} /></button>)}</div> : <p className="saved-empty">Las propuestas que revises se guardan en este navegador, dentro de la cuenta y curso seleccionados.</p>}</section>
  </>
}

export default App
