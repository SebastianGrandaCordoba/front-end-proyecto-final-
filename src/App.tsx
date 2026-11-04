import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, ChevronsUpDown, FolderOpen, Home, LogOut, Menu, Settings, Users, UsersRound, Activity, X } from 'lucide-react'
import type { TeacherProfile } from './api'
import FairTeamMark from './FairTeamMark'
import { Spinner } from './components/ui'
import { useRouter, type Route } from './app/router'
import { useWorkspace } from './app/useWorkspace'
import type { WorkshopIntent } from './app/types'
import type { Candidate } from './lib/domain'
import HomePage from './pages/HomePage'
import StudentDetail from './pages/StudentDetail'

const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const FollowUpPage = lazy(() => import('./pages/FollowUpPage'))
const WorkshopsPage = lazy(() => import('./pages/WorkshopsPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const nav: { route: Route; label: string; icon: typeof Home; needsCourse?: boolean }[] = [
  { route: 'inicio', label: 'Inicio', icon: Home },
  { route: 'estudiantes', label: 'Estudiantes y notas', icon: Users, needsCourse: true },
  { route: 'seguimiento', label: 'Seguimiento', icon: Activity, needsCourse: true },
  { route: 'talleres', label: 'Talleres y quizzes', icon: BookOpenCheck, needsCourse: true },
  { route: 'equipos', label: 'Equipos', icon: UsersRound, needsCourse: true },
]

const titles: Record<Route, string> = {
  inicio: 'Inicio', estudiantes: 'Estudiantes y notas', seguimiento: 'Seguimiento', talleres: 'Talleres y quizzes', equipos: 'Equipos', cursos: 'Mis cursos', ajustes: 'Ajustes',
}

export default function App({ user, onLogout }: { user: TeacherProfile; onLogout: () => void }) {
  const workspace = useWorkspace(user)
  const { route, params, navigate } = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [intent, setIntent] = useState<WorkshopIntent | null>(null)
  const [reviewing, setReviewing] = useState<Candidate | null>(null)
  const { course, courses, setCourseId } = workspace

  useEffect(() => { document.title = `${titles[route]} · FairTeam` }, [route])
  useEffect(() => { setMenuOpen(false) }, [route])

  const startWorkshop = useCallback((next: WorkshopIntent) => {
    setIntent(next)
    setReviewing(null)
    navigate('talleres')
  }, [navigate])

  const pageProps = { workspace, navigate, startWorkshop, review: setReviewing }
  const needsCourse = nav.find(item => item.route === route)?.needsCourse && !course && workspace.coursesState === 'ready'

  return <div className="shell">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Menú principal">
      <div className="sidebar-brand">
        <FairTeamMark size={30} />
        <span className="wordmark" translate="no">FairTeam</span>
        <button className="icon-btn sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
      </div>

      <label className="course-picker">
        <span className="course-picker-label">Curso</span>
        <span className="course-picker-box">
          <FolderOpen size={16} aria-hidden />
          <select title={course?.name} value={course?.id ?? ''} onChange={event => { if (event.target.value === 'nuevo') { navigate('cursos', { nuevo: '1' }); return } setCourseId(event.target.value ? Number(event.target.value) : null) }} aria-label="Curso activo">
            {!courses.length && <option value="">{workspace.coursesState === 'loading' ? 'Cargando…' : 'Sin cursos'}</option>}
            {courses.map(item => <option key={item.id} value={item.id}>{item.name}{item.period ? ` · ${item.period}` : ''}</option>)}
            <option value="nuevo">+ Crear curso nuevo</option>
          </select>
          <ChevronsUpDown size={15} aria-hidden />
        </span>
      </label>

      <nav className="nav">
        {nav.map(item => {
          const Icon = item.icon
          const badge = item.route === 'seguimiento' && workspace.summary.low ? workspace.summary.low : null
          return <a key={item.route} href={`#/${item.route}`} className={`nav-item${route === item.route ? ' is-active' : ''}`} aria-current={route === item.route ? 'page' : undefined}>
            <Icon size={18} aria-hidden /><span>{item.label}</span>
            {badge != null && <span className="nav-badge" aria-label={`${badge} en refuerzo`}>{badge}</span>}
          </a>
        })}
      </nav>

      <div className="nav nav-secondary">
        <a href="#/cursos" className={`nav-item${route === 'cursos' ? ' is-active' : ''}`} aria-current={route === 'cursos' ? 'page' : undefined}><FolderOpen size={18} aria-hidden /><span>Mis cursos</span></a>
        <a href="#/ajustes" className={`nav-item${route === 'ajustes' ? ' is-active' : ''}`} aria-current={route === 'ajustes' ? 'page' : undefined}><Settings size={18} aria-hidden /><span>Ajustes</span></a>
      </div>

      <div className="sidebar-user">
        <span className="user-initials" aria-hidden>{user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
        <span className="user-meta"><b>{user.name}</b><small>{user.email}</small></span>
        <button className="icon-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button>
      </div>
    </aside>
    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

    <div className="mobile-bar">
      <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
      <span className="mobile-title">{titles[route]}</span>
      <FairTeamMark size={26} />
    </div>

    <main className="sheet" id="contenido" tabIndex={-1}>
      {workspace.coursesState === 'error' && <div className="banner banner-error" role="alert">
        <span>No pudimos conectar con el servidor. Si acaba de despertar, puede tardar hasta un minuto.</span>
        <button className="btn btn-secondary btn-small" onClick={() => { void workspace.loadCourses(); void workspace.loadShared() }}>Reintentar</button>
      </div>}
      <Suspense fallback={<div className="page-loading"><Spinner size={20} /> Cargando…</div>}>
        {route === 'inicio' && <HomePage {...pageProps} user={user} />}
        {needsCourse && route !== 'inicio' ? <NoCourse onCreate={() => navigate('cursos', { nuevo: '1' })} /> : <>
          {route === 'estudiantes' && <StudentsPage {...pageProps} params={params} />}
          {route === 'seguimiento' && <FollowUpPage {...pageProps} />}
          {route === 'talleres' && <WorkshopsPage {...pageProps} intent={intent} clearIntent={() => setIntent(null)} params={params} />}
          {route === 'equipos' && <TeamsPage {...pageProps} />}
        </>}
        {route === 'cursos' && <CoursesPage {...pageProps} params={params} />}
        {route === 'ajustes' && <SettingsPage {...pageProps} user={user} onLogout={onLogout} />}
      </Suspense>
    </main>

    {reviewing && <StudentDetail student={reviewing} grades={workspace.grades.filter(grade => Number(grade.studentId) === Number(reviewing.id))} subjects={workspace.subjects} onClose={() => setReviewing(null)} onStart={mode => startWorkshop({ mode, level: reviewing.level, student: reviewing, autoStart: true })} />}
  </div>
}

function NoCourse({ onCreate }: { onCreate: () => void }) {
  return <section className="page"><div className="empty empty-page">
    <span className="empty-icon" aria-hidden><FolderOpen size={22} /></span>
    <strong>Primero crea un curso</strong>
    <p>Tus estudiantes, notas y materiales se guardan dentro de cada curso.</p>
    <div className="empty-action"><button className="btn btn-primary" onClick={onCreate}>Crear curso</button></div>
  </div></section>
}

export type PageProps = {
  workspace: ReturnType<typeof useWorkspace>
  navigate: ReturnType<typeof useRouter>['navigate']
  startWorkshop: (intent: WorkshopIntent) => void
  review: (student: Candidate) => void
}
