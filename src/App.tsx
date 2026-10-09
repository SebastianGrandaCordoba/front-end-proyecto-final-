import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BookOpen, BrainCircuit,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Download, FileText, Filter, FolderKanban, GraduationCap, Grid2X2, Lightbulb,
  LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles, Target,
  Trash2, Trophy, Upload, Users, WandSparkles, X, BellRing, Database, RotateCw,
} from 'lucide-react'
import { API_BASE, request, type AcademicLevel, type GeneratedWorkshop, type Grade, type Project, type Student, type Team } from './api'
import type { User } from 'firebase/auth'

type Page = 'overview' | 'students' | 'projects' | 'teams' | 'workshops' | 'settings'
type Toast = { kind: 'success' | 'error' | 'info'; message: string }
type Candidate = Student & { level: AcademicLevel; average: number }
type TeamDraft = { name: string; members: Candidate[]; score?: number; explanation?: string }

const navItems: { id: Page; label: string; icon: typeof Grid2X2 }[] = [
  { id: 'overview', label: 'Resumen', icon: Grid2X2 },
  { id: 'students', label: 'Estudiantes', icon: GraduationCap },
  { id: 'teams', label: 'Equipos', icon: Users },
  { id: 'workshops', label: 'Talleres IA', icon: BrainCircuit },
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

function App({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const [page, setPage] = useState<Page>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [savedWorkshops, setSavedWorkshops] = useState<GeneratedWorkshop[]>(() => {
    try { return JSON.parse(localStorage.getItem('fairteam.workshops') || '[]') as GeneratedWorkshop[] } catch { return [] }
  })
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'error'>('loading')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [query, setQuery] = useState('')
  const [studentModal, setStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [workshopResult, setWorkshopResult] = useState<GeneratedWorkshop | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const notify = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      request<Student[]>('/api/students'), request<Grade[]>('/api/grades'),
      request<Project[]>('/api/projects'), request<Team[]>('/api/teams'),
    ])
    const [studentResult, gradeResult, projectResult, teamResult] = results
    if (studentResult.status === 'fulfilled') setStudents(studentResult.value)
    if (gradeResult.status === 'fulfilled') setGrades(gradeResult.value)
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value)
    if (teamResult.status === 'fulfilled') setTeams(teamResult.value)
    const online = results.some(result => result.status === 'fulfilled')
    setApiStatus(online ? 'online' : 'error')
    if (!online) notify('No pudimos conectar con el backend. Revisa tu conexión y vuelve a intentar.', 'error')
    setLoading(false)
  }, [notify])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { localStorage.setItem('fairteam.workshops', JSON.stringify(savedWorkshops)) }, [savedWorkshops])

  const candidates = useMemo<Candidate[]>(() => students.map(student => {
    const marks = grades.filter(grade => Number(grade.studentId) === Number(student.id)).map(grade => Number(grade.grade)).filter(Number.isFinite)
    const average = marks.length ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length : levelScore[levelOf(student.academicLevel)]
    const level: AcademicLevel = marks.length ? (average < 3 ? 'LOW' : average < 4 ? 'MEDIUM' : 'HIGH') : levelOf(student.academicLevel)
    return { ...student, level, average }
  }), [students, grades])

  const notifications = [
    ...(apiStatus === 'error' ? [{ id: 'backend', title: 'Backend sin conexión', detail: 'Comprueba el servicio y vuelve a cargar los datos.', page: 'settings' as Page }] : []),
    ...(candidates.some(student => student.level === 'LOW') ? [{ id: 'support', title: `${candidates.filter(student => student.level === 'LOW').length} estudiante(s) en refuerzo`, detail: 'Revisa sus promedios y prepara acompañamiento.', page: 'students' as Page }] : []),
    ...(savedWorkshops.length ? [{ id: 'workshops', title: `${savedWorkshops.length} taller(es) en tu biblioteca`, detail: 'Abre tus talleres recientes para consultarlos.', page: 'workshops' as Page }] : []),
  ]

  const setSaved = (workshop: GeneratedWorkshop) => {
    setWorkshopResult(workshop)
    setSavedWorkshops(current => [{ ...workshop, savedAt: new Date().toISOString() }, ...current.filter(item => item.title !== workshop.title)].slice(0, 20))
  }

  const openEditStudent = (student: Student) => { setEditingStudent(student); setStudentModal(true) }
  const openCreateStudent = () => { setEditingStudent(null); setStudentModal(true) }
  const title = page === 'settings' ? 'Configuración' : page === 'projects' ? 'Proyectos' : navItems.find(item => item.id === page)?.label || 'Resumen'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Users size={21} strokeWidth={2.4} /></div>
          <span>fair<span className="brand-green">team</span><sup>✳</sup></span>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <div className="workspace-switch"><div className="workspace-icon">A</div><div><strong>Aula de aprendizaje</strong><span>Espacio docente</span></div><ChevronDown size={15} /></div>
        <div className="nav-caption">MENÚ PRINCIPAL</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {navItems.map(item => {
            const Icon = item.icon
            return <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false) }}><Icon size={18} /><span>{item.label}</span>{item.id === 'workshops' && <span className="nav-new">IA</span>}</button>
          })}
        </nav>
        <div className="side-divider" />
        <div className="nav-caption">TU ESPACIO</div>
        <button className={`nav-link ${page === 'projects' ? 'active' : ''}`} onClick={() => { setPage('projects'); setMobileNav(false) }}><FolderKanban size={18} /><span>Proyectos</span></button>
        <button className={`nav-link ${page === 'settings' ? 'active' : ''}`} onClick={() => { setPage('settings'); setMobileNav(false) }}><Settings2 size={18} /><span>Configuración</span></button>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><Lightbulb size={17} /></div><strong>Un aula que aprende junta</strong><p>Equipos diversos, oportunidades para todos.</p><button onClick={() => setPage('teams')}>Conoce cómo funciona <ArrowRight size={14} /></button></div>
          <button className="profile-row profile-action" onClick={onLogout} title="Cerrar sesión"><div className="profile-avatar">{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName || 'PG').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div><div className="profile-meta"><strong>{user?.displayName || 'Vista previa local'}</strong><span>{user?.email || 'Docente · sesión de desarrollo'}</span></div><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumb"><span>FairTeam</span><ChevronRight size={14} /><strong>{title}</strong></div></div>
          <div className="topbar-actions"><div className={`connection-pill ${apiStatus}`}><span className="connection-dot" />{apiStatus === 'loading' ? 'Conectando' : apiStatus === 'online' ? 'Sistema activo' : 'Sin conexión'}</div><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(open => !open)} aria-label="Notificaciones" aria-expanded={notificationsOpen}><Bell size={18} />{notifications.length > 0 && <i />}</button>{notificationsOpen && <NotificationsPanel notifications={notifications} onSelect={target => { setPage(target); setNotificationsOpen(false) }} />}</div><button className="top-account-button" onClick={() => setPage('settings')} title="Abrir configuración de cuenta">{user?.photoURL ? <img className="top-avatar-image" src={user.photoURL} alt="" /> : <div className="top-avatar">{user?.displayName?.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PG'}</div>}</button></div>
        </header>

        <div className="page-content">
          {page === 'overview' && <Overview students={candidates} teams={teams} grades={grades} workshops={savedWorkshops} onNavigate={setPage} onCreateStudent={openCreateStudent} onRefresh={() => void refresh()} onSelectWorkshop={workshop => { setWorkshopResult(workshop); setPage('workshops') }} />}
          {page === 'students' && <StudentsPage students={candidates} query={query} setQuery={setQuery} busy={loading} onCreate={openCreateStudent} onEdit={openEditStudent} onRefresh={() => void refresh()} notify={notify} />}
          {page === 'projects' && <ProjectsPage projects={projects} teams={teams} onRefresh={() => void refresh()} onManageTeams={projectId => { setActiveProjectId(String(projectId)); setPage('teams') }} notify={notify} />}
          {page === 'teams' && <TeamsPage students={candidates} projects={projects} teams={teams} initialProjectId={activeProjectId} onRefresh={() => void refresh()} notify={notify} />}
          {page === 'workshops' && <WorkshopsPage saved={savedWorkshops} result={workshopResult} onGenerate={setSaved} onSelect={setWorkshopResult} notify={notify} />}
          {page === 'settings' && <SettingsPage user={user} apiStatus={apiStatus} students={students} grades={grades} projects={projects} teams={teams} workshops={savedWorkshops} onRefresh={() => void refresh()} onClearWorkshops={() => setSavedWorkshops([])} onLogout={onLogout} notify={notify} />}
          <footer className="page-footer"><span>FairTeam · Aprender en equipo</span><span>Diseñado para construir aulas más equilibradas</span></footer>
        </div>
      </main>

      {mobileNav && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
      {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.kind === 'success' ? <CheckCircle2 size={18} /> : toast.kind === 'error' ? <CircleHelp size={18} /> : <Lightbulb size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Cerrar aviso"><X size={15} /></button></div>}
      {studentModal && <StudentDialog student={editingStudent} onClose={() => setStudentModal(false)} onSaved={() => { setStudentModal(false); void refresh() }} notify={notify} />}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}

type AppNotice = { id: string; title: string; detail: string; page: Page }

function NotificationsPanel({ notifications, onSelect }: { notifications: AppNotice[]; onSelect: (page: Page) => void }) {
  return <section className="notification-popover" aria-label="Notificaciones"><div className="notification-popover-head"><div><strong>Notificaciones</strong><span>{notifications.length ? `${notifications.length} aviso(s) para revisar` : 'Estás al día'}</span></div><BellRing size={17} /></div>{notifications.length ? <div className="notification-list">{notifications.map(item => <button className="notification-item" key={item.id} onClick={() => onSelect(item.page)}><i className={`notice-dot notice-${item.id}`} /><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="notification-empty"><CheckCircle2 size={20} /><span>No hay avisos pendientes. Los avisos aparecerán aquí cuando haya estudiantes en refuerzo o una conexión que revisar.</span></div>}</section>
}

function SettingsPage({ user, apiStatus, students, grades, projects, teams, workshops, onRefresh, onClearWorkshops, onLogout, notify }: { user: User | null; apiStatus: 'loading' | 'online' | 'error'; students: Student[]; grades: Grade[]; projects: Project[]; teams: Team[]; workshops: GeneratedWorkshop[]; onRefresh: () => void; onClearWorkshops: () => void; onLogout: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
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
      <section className="panel settings-card account-settings"><div className="settings-card-heading"><span className="settings-icon mint-icon"><ShieldCheck size={19} /></span><div><div className="eyebrow">CUENTA</div><h2>Tu sesión</h2></div></div><div className="settings-account-row">{user?.photoURL ? <img src={user.photoURL} alt="" /> : <span className="settings-account-fallback">{(user?.displayName || 'PG').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>}<div><strong>{user?.displayName || 'Vista previa local'}</strong><span>{user?.email || 'Sesión de desarrollo'}</span></div></div><div className="settings-detail-row"><span>Proveedor de inicio</span><b>{user ? 'Google' : 'Vista previa'}</b></div><div className="settings-detail-row"><span>Correo verificado</span><b>{user ? (user.emailVerified ? 'Sí' : 'No') : 'Entorno local'}</b></div><button className="button button-outline settings-full-button" onClick={onLogout} disabled={!user}><LogOut size={16} /> Cerrar sesión</button></section>
      <section className="panel settings-card connection-settings"><div className="settings-card-heading"><span className={`settings-icon ${apiStatus === 'online' ? 'mint-icon' : 'peach-icon'}`}><Database size={19} /></span><div><div className="eyebrow">SERVICIO</div><h2>Conexión con FairTeam</h2></div></div><div className={`settings-status settings-status-${apiStatus}`}><i />{apiStatus === 'loading' ? 'Comprobando conexión' : apiStatus === 'online' ? 'Backend conectado' : 'No se pudo conectar'}</div><div className="settings-detail-row"><span>URL de API</span><code>{API_BASE}</code></div><p>Las listas de estudiantes, notas, proyectos y equipos se consultan desde este backend.</p><button className="button button-outline settings-full-button" onClick={() => void verifyConnection()} disabled={checking}>{checking ? <LoaderCircle size={16} className="spin" /> : <RotateCw size={16} />}{checking ? 'Comprobando…' : 'Comprobar y actualizar datos'}</button></section>
      <section className="panel settings-card preference-settings"><div className="settings-card-heading"><span className="settings-icon lilac-icon"><Users size={19} /></span><div><div className="eyebrow">PREFERENCIAS</div><h2>Formación de equipos</h2></div></div><label className="settings-select-label">Tamaño predeterminado de equipos<select value={teamSize} onChange={event => { const value = Number(event.target.value); setTeamSize(value); localStorage.setItem('fairteam.defaultTeamSize', String(value)); notify(`El tamaño predeterminado será de ${value} personas.`) }}>{[2, 3, 4, 5, 6].map(size => <option value={size} key={size}>{size} personas</option>)}</select></label><p>Este valor se usa al abrir el organizador. Si eliges un proyecto que ya existe, se conserva el tamaño definido en ese proyecto.</p></section>
      <section className="panel settings-card data-settings"><div className="settings-card-heading"><span className="settings-icon blue-icon"><Download size={19} /></span><div><div className="eyebrow">TUS DATOS</div><h2>Respaldo y biblioteca</h2></div></div><div className="settings-counts"><span><b>{students.length}</b> estudiantes</span><span><b>{grades.length}</b> notas</span><span><b>{projects.length}</b> proyectos</span><span><b>{teams.length}</b> equipos</span></div><button className="button button-dark settings-full-button" onClick={exportBackup}><Download size={16} /> Descargar respaldo JSON</button><button className="button button-outline settings-full-button" onClick={downloadGradeTemplate}><FileText size={16} /> Descargar plantilla de notas CSV</button><button className="text-button settings-clear-button" onClick={clearWorkshops} disabled={!workshops.length}><Trash2 size={14} /> Vaciar biblioteca de talleres ({workshops.length})</button><small>El respaldo contiene los datos disponibles en esta sesión y los talleres guardados en este navegador.</small></section>
    </div>
    <div className="info-banner settings-note"><ShieldCheck size={18} /><div><strong>Acceso protegido por la sesión</strong><p>Las solicitudes a la API incluyen el token de Firebase de tu cuenta. No compartas contraseñas ni claves de Gemini.</p></div></div>
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
  URL.revokeObjectURL(url)
}

function downloadGradeTemplate() {
  downloadFile('plantilla-notas-fairteam.csv', '\uFEFFid,studentId,subjectId,grade,period\r\n', 'text/csv;charset=utf-8')
}

function Overview({ students, teams, grades, workshops, onNavigate, onCreateStudent, onRefresh, onSelectWorkshop }: { students: Candidate[]; teams: Team[]; grades: Grade[]; workshops: GeneratedWorkshop[]; onNavigate: (page: Page) => void; onCreateStudent: () => void; onRefresh: () => void; onSelectWorkshop: (workshop: GeneratedWorkshop) => void }) {
  const low = students.filter(student => student.level === 'LOW').length
  const medium = students.filter(student => student.level === 'MEDIUM').length
  const high = students.filter(student => student.level === 'HIGH').length
  const avg = grades.length ? grades.reduce((sum, grade) => sum + Number(grade.grade || 0), 0) / grades.length : null
  const focusStudents = students.filter(student => student.level === 'LOW').slice(0, 4)
  return <>
    <div className="welcome-banner"><div className="welcome-text"><div className="welcome-date">{displayDate()}</div><h1>Hola, profe <span>👋</span></h1><p>Un buen equipo empieza por conocer a cada estudiante.</p><div className="welcome-actions"><button className="button button-dark" onClick={() => onNavigate('teams')}><WandSparkles size={16} /> Crear equipos <ArrowRight size={15} /></button><button className="button button-ghost" onClick={onCreateStudent}><Plus size={16} /> Agregar estudiante</button></div></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-spark spark-a">✦</div><div className="art-spark spark-b">✳</div><div className="art-card card-a"><div className="mini-avatar mint">M</div><div><b>María</b><i>Diseño</i></div><span className="mini-check"><Check size={12} /></span></div><div className="art-card card-b"><div className="mini-avatar lilac">J</div><div><b>Julián</b><i>Desarrollo</i></div><span className="mini-check"><Check size={12} /></span></div><div className="art-center"><Users size={31} /><span>juntos</span></div></div></div>
    <div className="metric-grid">
      <MetricCard icon={<GraduationCap size={19} />} label="Estudiantes" value={students.length} note="en tu aula" tone="mint" onClick={() => onNavigate('students')} />
      <MetricCard icon={<Users size={19} />} label="Equipos creados" value={teams.length} note={teams.length ? 'guardados en proyectos' : 'listos para organizar'} tone="lilac" onClick={() => onNavigate('teams')} />
      <MetricCard icon={<Target size={19} />} label="En refuerzo" value={low} note={students.length ? `${Math.round(low / students.length * 100)}% del grupo` : 'según notas disponibles'} tone="peach" onClick={() => onNavigate('students')} />
      <MetricCard icon={<Activity size={19} />} label="Promedio general" value={avg === null ? '—' : `${avg.toFixed(1)}`} note={avg === null ? 'importa notas para calcularlo' : 'sobre 5.0'} tone="blue" onClick={() => onNavigate('students')} />
    </div>
    <div className="dashboard-grid">
      <section className="panel level-panel"><div className="panel-heading"><div><div className="eyebrow">PANORAMA DEL AULA</div><h2>Niveles de aprendizaje</h2></div><button className="text-button" onClick={() => onNavigate('students')}>Ver estudiantes <ArrowRight size={14} /></button></div><p className="panel-copy">Una mirada rápida a cómo va avanzando tu grupo.</p>{students.length ? <div className="levels-content"><div className="level-chart"><div className="chart-y-labels"><span>{students.length}</span><span>{Math.ceil(students.length * .66)}</span><span>{Math.ceil(students.length * .33)}</span><span>0</span></div><div className="bar-chart"><div className="chart-grid-lines"><i /><i /><i /><i /></div>{[{ label: 'En refuerzo', value: low, color: 'var(--coral)' }, { label: 'En proceso', value: medium, color: 'var(--yellow)' }, { label: 'Avanzado', value: high, color: 'var(--green)' }].map(item => <div className="bar-group" key={item.label}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(item.value ? 9 : 0, students.length ? item.value / students.length * 100 : 0)}%`, background: item.color }}><span>{item.value}</span></div></div><span className="bar-label">{item.label}</span></div>)}</div></div><div className="level-legend"><span><i className="legend-dot coral" />En refuerzo <b>{low}</b></span><span><i className="legend-dot yellow" />En proceso <b>{medium}</b></span><span><i className="legend-dot green" />Avanzado <b>{high}</b></span></div></div> : <EmptyState icon={<Users size={21} />} title="Tu aula empieza aquí" text="Agrega estudiantes o importa sus notas para ver el panorama del grupo." action={<button className="button button-outline" onClick={onNavigate.bind(null, 'students')}><Plus size={15} /> Ir a estudiantes</button>} />}</section>
      <section className="panel focus-panel"><div className="panel-heading"><div><div className="eyebrow">ACOMPAÑAMIENTO</div><h2>Para tener en cuenta</h2></div><span className="soft-icon coral-icon"><Lightbulb size={18} /></span></div>{focusStudents.length ? <><p className="panel-copy">Estudiantes que podrían beneficiarse de un taller de refuerzo.</p><div className="focus-list">{focusStudents.map(student => <div className="focus-student" key={student.id}><Avatar name={student.name} /><div className="focus-info"><strong>{student.name}</strong><span>{student.average.toFixed(1)} / 5.0 · {student.email || 'Sin correo registrado'}</span></div><span className="level-badge level-low">Refuerzo</span></div>)}</div><button className="button button-soft-coral full-button" onClick={() => onNavigate('workshops')}><Sparkles size={16} /> Preparar taller de refuerzo <ArrowRight size={15} /></button></> : <EmptyState icon={<CheckCircle2 size={21} />} title={students.length ? 'Todo va tomando forma' : 'Aún no hay alertas'} text={students.length ? 'No hay estudiantes clasificados en nivel de refuerzo por ahora.' : 'Al importar notas podrás identificar quién necesita apoyo.'} action={<button className="text-button" onClick={() => onNavigate('students')}>Revisar estudiantes <ArrowRight size={14} /></button>} />}</section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel shortcuts-panel"><div className="panel-heading"><div><div className="eyebrow">SIGUIENTE PASO</div><h2>¿Qué quieres hacer?</h2></div></div><div className="shortcut-grid"><button className="shortcut-card" onClick={() => onNavigate('students')}><span className="shortcut-icon peach-icon"><ArrowDownToLine size={19} /></span><span><b>Importar notas</b><small>Actualiza niveles con un CSV</small></span><ArrowUpRight size={16} /></button><button className="shortcut-card" onClick={() => onNavigate('teams')}><span className="shortcut-icon mint-icon"><Users size={19} /></span><span><b>Equilibrar equipos</b><small>Distribuye fortalezas del aula</small></span><ArrowUpRight size={16} /></button><button className="shortcut-card" onClick={() => onNavigate('workshops')}><span className="shortcut-icon lilac-icon"><BrainCircuit size={19} /></span><span><b>Crear un taller con IA</b><small>Parte del material de estudio</small></span><ArrowUpRight size={16} /></button></div></section>
      <section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">TU ACTIVIDAD</div><h2>Lo más reciente</h2></div><button className="icon-button small-icon" onClick={onRefresh} aria-label="Actualizar"><Activity size={16} /></button></div>{workshops.length || teams.length ? <div className="activity-list">{workshops.slice(0, 2).map((workshop, index) => <button className="activity-item activity-action" key={`${workshop.title}-${index}`} onClick={() => onSelectWorkshop(workshop)}><div className="activity-icon lilac-icon"><BookOpen size={16} /></div><div><b>{workshop.title}</b><span>Taller guardado en este navegador</span></div><ChevronRight size={15} /></button>)}{teams.slice(0, 2).map(team => <button className="activity-item activity-action" key={team.id} onClick={() => onNavigate('teams')}><div className="activity-icon mint-icon"><Users size={16} /></div><div><b>{team.name}</b><span>{team.project?.name || 'Equipo guardado'}</span></div><ChevronRight size={15} /></button>)}</div> : <EmptyState icon={<Clock3 size={20} />} title="Tu actividad aparecerá aquí" text="Cuando importes notas, crees grupos o generes talleres, los verás en este espacio." />}</section>
    </div>
  </>
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

function StudentsPage({ students, query, setQuery, busy, onCreate, onEdit, onRefresh, notify }: { students: Candidate[]; query: string; setQuery: (query: string) => void; busy: boolean; onCreate: () => void; onEdit: (student: Student) => void; onRefresh: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [filter, setFilter] = useState<'ALL' | AcademicLevel>('ALL')
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const filtered = students.filter(student => (filter === 'ALL' || student.level === filter) && `${student.name} ${student.email || ''}`.toLowerCase().includes(query.toLowerCase()))
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) return notify('El archivo debe tener formato CSV.', 'error')
    setImporting(true)
    const form = new FormData(); form.append('file', file)
    try {
      const imported = await request<Grade[]>('/api/grades/import', { method: 'POST', body: form })
      notify(`Se importaron ${imported.length} registros de notas.`)
      onRefresh()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo importar el archivo.', 'error') }
    finally { setImporting(false) }
  }
  const deleteStudent = async (student: Student) => {
    if (!window.confirm(`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`)) return
    setDeleting(student.id)
    try { await request<void>(`/api/students/${student.id}`, { method: 'DELETE' }); notify('Estudiante eliminado.'); onRefresh() }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error') }
    finally { setDeleting(null) }
  }
  return <>
    <PageHeading eyebrow="TU COMUNIDAD" title="Estudiantes" description="Conoce el punto de partida de cada persona y acompaña su progreso." action={<><label className={`button button-outline upload-button ${importing ? 'is-loading' : ''}`}><input type="file" accept=".csv,text/csv" onChange={importFile} disabled={importing} />{importing ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}{importing ? 'Importando…' : 'Importar notas'}</label><button className="button button-dark" onClick={onCreate}><Plus size={16} /> Agregar estudiante</button></>} />
    <section className="panel directory-panel"><div className="directory-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o correo…" /></div><div className="filter-control"><Filter size={16} /><select value={filter} onChange={event => setFilter(event.target.value as 'ALL' | AcademicLevel)} aria-label="Filtrar por nivel"><option value="ALL">Todos los niveles</option><option value="LOW">En refuerzo</option><option value="MEDIUM">En proceso</option><option value="HIGH">Avanzado</option></select><ChevronDown size={14} /></div><button className="icon-button small-icon" onClick={onRefresh} aria-label="Actualizar lista"><Activity size={16} /></button></div>
      <div className="table-wrap"><table className="student-table"><thead><tr><th>ESTUDIANTE</th><th>NIVEL ACTUAL</th><th>PROMEDIO</th><th>PROGRESO</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filtered.map(student => <tr key={student.id}><td><div className="student-cell"><Avatar name={student.name} /><span><strong>{student.name}</strong><small>{student.email || `ID ${student.id}`}</small></span></div></td><td><span className={`level-badge level-${student.level.toLowerCase()}`}><i />{formatLevel(student.level)}</span></td><td><strong className="grade-number">{student.average.toFixed(1)}</strong><span className="grade-total"> / 5.0</span></td><td><div className="progress-cell"><div className="progress-track"><i style={{ width: `${Math.min(100, student.average / 5 * 100)}%` }} /></div><small>{Math.round(student.average / 5 * 100)}%</small></div></td><td><div className="row-actions"><button className="icon-button small-icon" onClick={() => onEdit(student)} aria-label={`Editar ${student.name}`}><MoreHorizontal size={17} /></button><button className="icon-button small-icon danger-hover" onClick={() => void deleteStudent(student)} disabled={deleting === student.id} aria-label={`Eliminar ${student.name}`}>{deleting === student.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}</button></div></td></tr>)}</tbody></table>
        {busy && <div className="table-loading"><LoaderCircle size={19} className="spin" /> Actualizando estudiantes…</div>}
        {!busy && filtered.length === 0 && <EmptyState icon={<GraduationCap size={22} />} title={students.length ? 'No encontramos coincidencias' : 'Aún no hay estudiantes'} text={students.length ? 'Prueba con otro nombre o cambia el filtro.' : 'Agrega tu grupo manualmente o importa una lista de notas para comenzar.'} action={!students.length ? <button className="button button-dark" onClick={onCreate}><Plus size={15} /> Agregar primer estudiante</button> : undefined} />}
      </div><div className="table-footer"><span>Mostrando <b>{filtered.length}</b> de <b>{students.length}</b> estudiantes</span><span className="api-footnote">Niveles calculados con notas importadas; si no hay notas, se usa el nivel del perfil.</span></div>
    </section>
    <div className="info-banner"><FileText size={18} /><div><strong>Formato de archivo para importar notas</strong><p>El CSV debe incluir <code>id,studentId,subjectId,grade,period</code>. Los tres IDs deben existir en la base de datos. Usa la plantilla descargable para evitar errores de encabezado.</p></div><button className="text-button" onClick={downloadGradeTemplate}>Descargar plantilla <Download size={14} /></button></div>
  </>
}

function StudentDialog({ student, onClose, onSaved, notify }: { student: Student | null; onClose: () => void; onSaved: () => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [name, setName] = useState(student?.name || '')
  const [email, setEmail] = useState(student?.email || '')
  const [level, setLevel] = useState(levelOf(student?.academicLevel))
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      await request<Student>(student ? `/api/students/${student.id}` : '/api/students', {
        method: student ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, academicLevel: level }),
      })
      notify(student ? 'Perfil actualizado.' : 'Estudiante agregado.')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el perfil.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal onClose={onClose} title={student ? 'Editar estudiante' : 'Agregar estudiante'}><form className="form-stack" onSubmit={submit}><label>Nombre completo<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Valentina Rojas" /></label><label>Correo electrónico <span className="optional-label">Opcional</span><input type="email" maxLength={180} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@institucion.edu.co" /></label><label>Nivel inicial<select value={level} disabled={Boolean(student)} onChange={event => setLevel(event.target.value as AcademicLevel)}><option value="LOW">En refuerzo</option><option value="MEDIUM">En proceso</option><option value="HIGH">Avanzado</option></select></label>{student && <div className="form-note"><Lightbulb size={15} /> El backend permite editar nombre y correo. El nivel se calcula con las notas importadas y por eso no se puede cambiar aquí.</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button button-dark" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Guardando…' : 'Guardar estudiante'}</button></div></form></Modal>
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><div className="eyebrow">FAIRTEAM</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>{children}</section></div>
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

function WorkshopsPage({ saved, result, onGenerate, onSelect, notify }: { saved: GeneratedWorkshop[]; result: GeneratedWorkshop | null; onGenerate: (workshop: GeneratedWorkshop) => void; onSelect: (workshop: GeneratedWorkshop | null) => void; notify: (message: string, kind?: Toast['kind']) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState<AcademicLevel>('LOW')
  const [objective, setObjective] = useState('')
  const [generating, setGenerating] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const selectFile = (candidate?: File) => {
    if (!candidate) return
    if (!/\.(pdf|docx|txt)$/i.test(candidate.name)) return notify('Adjunta un archivo PDF, DOCX o TXT.', 'error')
    if (candidate.size > 10 * 1024 * 1024) return notify('El archivo supera el límite de 10 MB.', 'error')
    setFile(candidate)
  }
  const generate = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return notify('Adjunta el material que servirá de base para el taller.', 'error')
    if (file.size > 10 * 1024 * 1024) return notify('El archivo supera el límite de 10 MB.', 'error')
    setGenerating(true)
    try {
      const form = new FormData(); form.append('file', file); form.append('subject', subject.trim()); form.append('targetLevel', level); if (objective.trim()) form.append('learningObjective', objective.trim())
      const response = await request<GeneratedWorkshop>('/api/ai/workshops/generate', { method: 'POST', body: form })
      onGenerate(response); notify('¡Taller listo! Revísalo y ajusta lo necesario antes de asignarlo.')
    } catch (error) { notify(error instanceof Error ? error.message : 'No pudimos generar el taller.', 'error') }
    finally { setGenerating(false) }
  }
  const copy = async () => {
    if (!result) return
    const text = `${result.title}\n${result.summary}\n\nOBJETIVOS\n${result.learningObjectives.map(item => `• ${item}`).join('\n')}\n\nACTIVIDADES\n${result.activities.map((item, index) => `${index + 1}. ${item.title} (${item.estimatedMinutes} min)\n${item.instructions}`).join('\n\n')}\n\nEVALUACIÓN\n${result.assessment.map((item, index) => `${index + 1}. ${item.question}\n${item.options.map(option => `- ${option}`).join('\n')}\nRespuesta: ${item.correctAnswer}\n${item.explanation}`).join('\n\n')}\n\nReferencias: ${result.sourceReferences.join(', ')}`
    try { await navigator.clipboard.writeText(text); notify('Contenido copiado al portapapeles.') } catch { notify('No se pudo copiar el contenido.', 'error') }
  }
  return <>
    <PageHeading eyebrow="APRENDIZAJE PERSONALIZADO" title="Laboratorio de talleres" description="Convierte el material de clase en actividades y preguntas para reforzar el aprendizaje." action={<span className="ai-badge"><Sparkles size={15} /> Gemini integrado</span>} />
    <div className="workshop-layout"><section className="panel workshop-form-panel"><div className="panel-heading"><div><div className="eyebrow">CREAR CON IA</div><h2>Cuéntanos qué están aprendiendo</h2></div><span className="soft-icon lilac-icon"><BrainCircuit size={19} /></span></div><p className="panel-copy">La IA usará únicamente el archivo y las instrucciones que compartas para proponer un taller de refuerzo.</p><form className="form-stack" onSubmit={generate}><label>Material de estudio</label><button type="button" className={`dropzone ${file ? 'has-file' : ''}`} onClick={() => uploadRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }}><input ref={uploadRef} type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={event => selectFile(event.target.files?.[0])} />{file ? <><span className="dropzone-icon file-selected"><CheckCircle2 size={22} /></span><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · Toca para cambiar el archivo</small><span className="remove-file" onClick={event => { event.stopPropagation(); setFile(null) }} aria-label="Quitar archivo"><X size={15} /></span></> : <><span className="dropzone-icon"><Upload size={21} /></span><strong>Arrastra tu material aquí</strong><small>o <u>explora tus archivos</u> · PDF, DOCX o TXT · Hasta 10 MB</small></>}</button><div className="form-row-two"><label>Materia<input required maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ej. Biología" /></label><label>Nivel de refuerzo<select value={level} onChange={event => setLevel(event.target.value as AcademicLevel)}><option value="LOW">En refuerzo</option><option value="MEDIUM">En proceso</option><option value="HIGH">Avanzado</option></select></label></div><label>Objetivo de aprendizaje <span className="optional-label">Opcional</span><textarea rows={3} maxLength={1000} value={objective} onChange={event => setObjective(event.target.value)} placeholder="Ej. Comprender las etapas de la fotosíntesis…" /></label><div className="ai-privacy-note"><CheckCircle2 size={15} /><span>El material se procesa para generar el taller. No adjuntes listas de estudiantes ni datos personales.</span></div><button className="button button-dark full-button generate-button" disabled={generating}>{generating ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{generating ? 'Creando una propuesta… puede tardar un minuto' : 'Generar taller de refuerzo'}{!generating && <ArrowRight size={15} />}</button></form><div className="generation-hint"><Clock3 size={14} /> Normalmente toma entre 20 y 60 segundos.</div></section>
      <section className="panel workshop-output-panel"><div className="panel-heading"><div><div className="eyebrow">TU PROPUESTA</div><h2>{result?.title || 'El taller aparecerá aquí'}</h2></div>{result && <button className="icon-button small-icon" onClick={() => window.print()} aria-label="Imprimir taller"><Download size={16} /></button>}</div>{result ? <div className="workshop-result" id="print-workshop"><div className="workshop-meta"><span className="subject-pill">{result.subject}</span><span className={`level-badge level-${levelOf(result.targetLevel).toLowerCase()}`}>{formatLevel(levelOf(result.targetLevel))}</span><span className="duration-pill"><Clock3 size={13} />{result.activities.reduce((sum, activity) => sum + activity.estimatedMinutes, 0)} min</span></div><p className="workshop-summary">{result.summary}</p><div className="result-section"><h3><Target size={16} /> Objetivos de aprendizaje</h3><ul className="objective-list">{result.learningObjectives.map((item, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ul></div><div className="result-section"><h3><BookOpen size={16} /> Actividades</h3><div className="activity-cards">{result.activities.map((activity, index) => <article className="workshop-activity" key={`${activity.title}-${index}`}><div className="activity-index">{String(index + 1).padStart(2, '0')}</div><div><div className="activity-title-line"><b>{activity.title}</b><span><Clock3 size={12} />{activity.estimatedMinutes} min</span></div><p>{activity.instructions}</p></div></article>)}</div></div><div className="result-section"><h3><CheckCircle2 size={16} /> Comprueba lo aprendido</h3><div className="assessment-list">{result.assessment.map((item, index) => <details className="assessment-item" key={`${item.question}-${index}`}><summary><span>{index + 1}</span>{item.question}<ChevronDown size={15} /></summary><div className="assessment-content"><ul>{item.options.map((option, optionIndex) => <li className={option === item.correctAnswer ? 'correct-answer' : ''} key={optionIndex}>{option === item.correctAnswer && <Check size={13} />}{option}</li>)}</ul><p><b>Respuesta:</b> {item.correctAnswer}. {item.explanation}</p></div></details>)}</div></div><div className="source-note"><FileText size={14} /><span>Referencias del material: {result.sourceReferences.join(' · ') || 'No especificadas'}</span></div><div className="result-actions"><button className="button button-dark" onClick={() => void copy()}><Download size={15} /> Copiar taller</button><button className="button button-outline" onClick={() => window.print()}><FileText size={15} /> Imprimir / PDF</button></div><p className="review-note"><Lightbulb size={14} /> Revisa la propuesta antes de compartirla con el grupo.</p></div> : <EmptyState icon={<WandSparkles size={24} />} title="Una idea para empezar" text="Cuando generes un taller, aquí podrás revisar objetivos, actividades, evaluación y referencias del material." action={<div className="output-preview"><span><Check size={13} /> Objetivos claros</span><span><Check size={13} /> Actividades prácticas</span><span><Check size={13} /> Preguntas para evaluar</span></div>} />}</section></div>
    <section className="saved-workshops-section"><div className="section-heading"><div><div className="eyebrow">TU BIBLIOTECA</div><h2>Talleres recientes</h2></div><span className="saved-count">{saved.length}</span></div>{saved.length ? <div className="saved-workshop-grid">{saved.map((workshop, index) => <button className={`saved-workshop-card ${result?.title === workshop.title ? 'selected' : ''}`} key={`${workshop.title}-${index}`} onClick={() => onSelect(workshop)}><span className="shortcut-icon lilac-icon"><BookOpen size={17} /></span><span className="saved-workshop-copy"><b>{workshop.title}</b><small>{workshop.subject} · {workshop.activities.length} actividades</small></span><ChevronRight size={16} /></button>)}</div> : <p className="saved-empty">Los talleres que generes se guardan en este navegador para que vuelvas a consultarlos.</p>}</section>
  </>
}

export default App
