import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Menu } from 'lucide-react'
import type { TeacherProfile } from './api'
import FairTeamMark from './FairTeamMark'
import { Spinner } from './components/ui'
import { useRouter, type Route } from './app/router'
import { useWorkspace } from './app/useWorkspace'
import type { WorkshopIntent } from './app/types'
import type { Candidate } from './lib/domain'
import HomePage from './pages/HomePage'
import StudentDetail from './pages/StudentDetail'
import MessageDialog from './pages/MessageDialog'
import Buho, { type BuhoContext } from './components/Buho'
import Sidebar, { nav } from './components/Sidebar'
import ShortcutsDialog from './components/ShortcutsDialog'
import Welcome from './components/Welcome'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import type { BuhoAction } from './lib/buho'
import { printCourseReport } from './lib/report'

const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const FollowUpPage = lazy(() => import('./pages/FollowUpPage'))
const WorkshopsPage = lazy(() => import('./pages/WorkshopsPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const titles: Record<Route, string> = {
  inicio: 'Inicio', estudiantes: 'Estudiantes y notas', seguimiento: 'Seguimiento', talleres: 'Talleres y quizzes', equipos: 'Equipos', cursos: 'Mis cursos', ajustes: 'Ajustes',
}

export default function App({ user, onLogout }: { user: TeacherProfile; onLogout: () => void }) {
  const workspace = useWorkspace(user)
  const { route, params, navigate } = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [intent, setIntent] = useState<WorkshopIntent | null>(null)
  const [reviewing, setReviewing] = useState<Candidate | null>(null)
  const [messageFor, setMessageFor] = useState<Candidate | null>(null)
  const [buhoOpen, setBuhoOpen] = useState(false)
  const [briefToken, setBriefToken] = useState(0)
  const { course, courses, setCourseId } = workspace

  const buhoContext: BuhoContext = useMemo(() => ({ teacher: user.name, courseId: course?.id ?? null, courseName: course?.name ?? null, candidates: workspace.candidates, weakestSubject: workspace.insights[0]?.name ?? null }), [user.name, course, workspace.candidates, workspace.insights])

  const report = useCallback(() => {
    if (!course) return
    printCourseReport({ course, teacher: user.name, summary: workspace.summary, insights: workspace.insights, trends: workspace.trends, projections: workspace.projections, workshops: workspace.workshops })
  }, [course, user.name, workspace.summary, workspace.insights, workspace.trends, workspace.projections, workspace.workshops])
  const brief = useCallback(() => { setBuhoOpen(true); setBriefToken(value => value + 1) }, [])

  useEffect(() => { document.title = `${titles[route]} · FairTeam` }, [route])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const welcomeKey = `fairteam.welcome.${user.id}`
  const [showWelcome, setShowWelcome] = useState(() => { try { return !localStorage.getItem(welcomeKey) } catch { return false } })
  const closeWelcome = () => { try { localStorage.setItem(welcomeKey, '1') } catch { /* private mode */ } setShowWelcome(false) }
  // "?" shows the shortcuts; "g" then a letter jumps to a screen. Ignored while typing.
  useEffect(() => {
    let pendingG = 0
    const goto: Record<string, Route> = { i: 'inicio', e: 'estudiantes', s: 'seguimiento', t: 'talleres', q: 'equipos', c: 'cursos' }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === '?') { event.preventDefault(); setShowShortcuts(true); return }
      if (event.key === 'g') { pendingG = Date.now(); return }
      if (Date.now() - pendingG < 900 && goto[event.key]) { navigate(goto[event.key]); pendingG = 0 }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
  useEffect(() => { setMenuOpen(false) }, [route])
  // Move focus to the content after navigating so screen readers announce the new page.
  useEffect(() => { document.getElementById('contenido')?.focus({ preventScroll: true }) }, [route])

  const startWorkshop = useCallback((next: WorkshopIntent) => {
    setIntent(next)
    setReviewing(null)
    navigate('talleres')
  }, [navigate])

  const runAction = useCallback((action: BuhoAction) => {
    if (window.matchMedia('(max-width: 860px)').matches && action.kind !== 'briefing') setBuhoOpen(false)
    switch (action.kind) {
      case 'navigate': return navigate(action.route, action.params)
      case 'workshop': return startWorkshop({ mode: action.mode, level: action.level, topic: action.topic, student: action.student })
      case 'review': return setReviewing(action.student)
      case 'message': return setMessageFor(action.student)
      case 'report': return report()
      case 'briefing': return brief()
      case 'course': setCourseId(action.courseId); return navigate('inicio')
    }
  }, [navigate, startWorkshop, report, brief, setCourseId])

  const pageProps = { workspace, navigate, startWorkshop, review: setReviewing, assistant: { brief, report, message: setMessageFor, open: () => setBuhoOpen(true) } }
  const needsCourse = nav.find(item => item.route === route)?.needsCourse && !course && workspace.coursesState === 'ready'

  return <div className={`shell${buhoOpen ? ' buho-open' : ''}`}>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <Sidebar route={route} navigate={navigate} user={user} onLogout={onLogout} course={course} courses={courses} coursesLoading={workspace.coursesState === 'loading'}
      setCourseId={setCourseId} lowCount={workspace.summary.low} menuOpen={menuOpen} closeMenu={() => setMenuOpen(false)} buhoOpen={buhoOpen} toggleBuho={() => setBuhoOpen(!buhoOpen)} />
    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

    <div className="mobile-bar">
      <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
      <span className="mobile-title">{titles[route]}</span>
      <button className="buho-mobile" onClick={() => setBuhoOpen(true)} aria-label="Abrir el asistente Búho"><FairTeamMark size={28} /><span>Búho</span></button>
    </div>

    <main className="sheet" id="contenido" tabIndex={-1}>
      <OfflineBanner />
      {workspace.coursesState === 'error' && <div className="banner banner-error" role="alert">
        <span>No pudimos conectar con el servidor. Si acaba de despertar, puede tardar hasta un minuto.</span>
        <button className="btn btn-secondary btn-small" onClick={() => { void workspace.loadCourses(); void workspace.loadShared() }}>Reintentar</button>
      </div>}
      <ErrorBoundary resetKey={route}>
      <Suspense fallback={<div className="page-loading" role="status" aria-live="polite"><Spinner size={20} /> Cargando…</div>}>
        {route === 'inicio' && <HomePage {...pageProps} user={user} />}
        {needsCourse && route !== 'inicio' ? <NoCourse onCreate={() => navigate('cursos', { nuevo: '1' })} /> : <>
          {route === 'estudiantes' && <StudentsPage {...pageProps} params={params} />}
          {route === 'seguimiento' && <FollowUpPage {...pageProps} params={params} />}
          {route === 'talleres' && <WorkshopsPage {...pageProps} intent={intent} clearIntent={() => setIntent(null)} params={params} />}
          {route === 'equipos' && <TeamsPage {...pageProps} />}
        </>}
        {route === 'cursos' && <CoursesPage {...pageProps} params={params} />}
        {route === 'ajustes' && <SettingsPage {...pageProps} user={user} onLogout={onLogout} />}
      </Suspense>
      </ErrorBoundary>
    </main>

    {reviewing && <StudentDetail student={reviewing} trend={workspace.trends.find(t => t.student.id === reviewing.id) ?? null} projection={workspace.projections.get(reviewing.id) ?? null} grades={workspace.grades.filter(grade => Number(grade.studentId) === Number(reviewing.id))} subjects={workspace.subjects} courseAverage={workspace.summary.average} onClose={() => setReviewing(null)} onMessage={() => { setMessageFor(reviewing); setReviewing(null) }} onStart={mode => startWorkshop({ mode, level: reviewing.level, student: reviewing, autoStart: true })} />}
    {messageFor && course && <MessageDialog courseId={course.id} student={messageFor} onClose={() => setMessageFor(null)} />}
    {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    {showWelcome && <Welcome onClose={closeWelcome} />}
    <Buho context={buhoContext} onAction={runAction} open={buhoOpen} setOpen={setBuhoOpen} briefToken={briefToken} />
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
  assistant: { brief: () => void; report: () => void; message: (student: Candidate) => void; open: () => void }
}
