import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Menu } from 'lucide-react'
import { request, type TeacherProfile } from './api'
import FairTeamMark from './FairTeamMark'
import { Spinner, useFeedback } from './components/ui'
import { DemoButton } from './components/DemoButton'
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
import Tour from './components/Tour'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import type { BuhoAction } from './lib/buho'
import { printCourseReport } from './lib/report'
import { guideDone, openGuide, spotlight } from './lib/guide'
import Spotlight from './components/Spotlight'
import Guide from './components/Guide'

const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const FollowUpPage = lazy(() => import('./pages/FollowUpPage'))
const WorkshopsPage = lazy(() => import('./pages/WorkshopsPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const RubricsPage = lazy(() => import('./pages/RubricsPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const titles: Record<Route, string> = {
  home: 'Inicio', students: 'Estudiantes y notas', 'follow-up': 'Seguimiento', workshops: 'Talleres y quizzes', rubrics: 'Rúbricas', teams: 'Equipos', courses: 'Mis cursos', settings: 'Ajustes',
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
  const { notify } = useFeedback()

  const buhoContext: BuhoContext = useMemo(() => ({ teacher: user.name, courseId: course?.id ?? null, courseName: course?.name ?? null, candidates: workspace.candidates, weakestSubject: workspace.insights[0]?.name ?? null }), [user.name, course, workspace.candidates, workspace.insights])

  const report = useCallback(() => {
    if (!course) return
    printCourseReport({ course, teacher: user.name, summary: workspace.summary, insights: workspace.insights, trends: workspace.trends, projections: workspace.projections, workshops: workspace.workshops })
  }, [course, user.name, workspace.summary, workspace.insights, workspace.trends, workspace.projections, workspace.workshops])
  const brief = useCallback(() => { setBuhoOpen(true); setBriefToken(value => value + 1) }, [])

  useEffect(() => { document.title = `${titles[route]} · FairTeam` }, [route])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const welcomeKey = `fairteam.welcome.${user.id}`
  // The quick tour (look only) opens on demand; new teachers get "Primeros pasos", which waits for each action.
  const [showWelcome, setShowWelcome] = useState(false)
  // Ajustes and the guide can open the quick tour at any time.
  useEffect(() => {
    const open = () => setShowWelcome(true)
    window.addEventListener('fairteam:tour', open)
    return () => window.removeEventListener('fairteam:tour', open)
  }, [])
  const closeWelcome = () => { try { localStorage.setItem(welcomeKey, '1') } catch { /* private mode */ } setShowWelcome(false) }
  // "?" shows the shortcuts; "g" then a letter jumps to a screen. Ignored while typing.
  useEffect(() => {
    let pendingG = 0
    const goto: Record<string, Route> = { i: 'home', e: 'students', s: 'follow-up', t: 'workshops', r: 'rubrics', q: 'teams', c: 'courses' }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return
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
    navigate('workshops')
  }, [navigate])

  /** "Crea una rúbrica para el último taller de X": find it, build the rubric from its content, save and open it. */
  const rubricFromLatest = useCallback(async (topic?: string, target?: 'workshop' | 'quiz', activityId?: number, prompt?: string) => {
    if (!course) return
    notify('Estoy armando la rúbrica a partir del taller. Tarda unos segundos…', 'info')
    try {
      const rubric = await request<{ id: number; activityTitle: string | null }>(`/api/courses/${course.id}/rubrics/from-activity`,
        { method: 'POST', body: JSON.stringify({ activityId: activityId ?? null, kind: target ?? 'workshop', topic: topic ?? null, criteriaCount: 4, teacherPrompt: prompt ?? null }) })
      guideDone('rubric')
      notify(`Rúbrica lista para "${rubric.activityTitle ?? 'el taller'}". Revísala y empieza a calificar.`)
      navigate('rubrics', { id: String(rubric.id), view: 'rubric' })
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo crear la rúbrica.', 'error') }
  }, [course, navigate, notify])

  const runAction = useCallback((action: BuhoAction) => {
    if (window.matchMedia('(max-width: 860px)').matches && action.kind !== 'briefing') setBuhoOpen(false)
    switch (action.kind) {
      case 'navigate': {
        // "Llévame": open the page and ring the control Búho explained.
        const { highlight, ...rest } = action.params ?? {}
        navigate(action.route, Object.keys(rest).length ? rest : undefined)
        if (highlight) spotlight(highlight)
        return
      }
      case 'guide': return openGuide()
      // Búho's buttons do the work ("Preparar refuerzo" creates it); they never leave a form waiting for a click.
      case 'workshop': return startWorkshop({ mode: action.mode, level: action.level, topic: action.topic, student: action.student, autoStart: true, prompt: action.prompt })
      case 'rubric': return void rubricFromLatest(action.topic, action.target, action.activityId, action.prompt)
      case 'review': return setReviewing(action.student)
      case 'message': return setMessageFor(action.student)
      case 'report': return report()
      case 'briefing': return brief()
      case 'course': setCourseId(action.courseId); return navigate('home')
    }
  }, [navigate, startWorkshop, report, brief, setCourseId, rubricFromLatest])

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
      <div className="topbar">
        <nav className="crumbs" aria-label="Ubicación">
          {course && <a className="crumb-course" href="#/courses" title="Cambiar de curso"><FolderOpen size={14} aria-hidden />{course.name}</a>}
          {course && <span aria-hidden className="crumb-sep">/</span>}
          <b>{titles[route]}</b>
        </nav>
        <button className="topbar-ask" onClick={() => setBuhoOpen(true)}><FairTeamMark size={20} /><span>Pregúntale al Búho</span><kbd aria-hidden>Ctrl K</kbd></button>
      </div>
      <OfflineBanner />
      {workspace.coursesState === 'error' && <div className="banner banner-error" role="alert">
        <span>No pudimos conectar con el servidor. Si acaba de despertar, puede tardar hasta un minuto.</span>
        <button className="btn btn-secondary btn-small" onClick={() => { void workspace.loadCourses(); void workspace.loadShared() }}>Reintentar</button>
      </div>}
      <ErrorBoundary resetKey={route}>
      <Suspense fallback={<div className="page-loading" role="status" aria-live="polite"><Spinner size={20} /> Cargando…</div>}>
        {route === 'home' && <HomePage {...pageProps} user={user} />}
        {needsCourse && route !== 'home' ? <NoCourse route={route} onCreate={() => navigate('courses', { new: '1' })} onDemo={workspace.loadCourses} /> : <>
          {route === 'students' && <StudentsPage {...pageProps} params={params} />}
          {route === 'follow-up' && <FollowUpPage {...pageProps} params={params} />}
          {route === 'workshops' && <WorkshopsPage {...pageProps} intent={intent} clearIntent={() => setIntent(null)} params={params} />}
          {route === 'rubrics' && <RubricsPage {...pageProps} params={params} />}
          {route === 'teams' && <TeamsPage {...pageProps} />}
        </>}
        {route === 'courses' && <CoursesPage {...pageProps} params={params} />}
        {route === 'settings' && <SettingsPage {...pageProps} user={user} onLogout={onLogout} />}
      </Suspense>
      </ErrorBoundary>
    </main>

    {reviewing && <StudentDetail student={reviewing} trend={workspace.trends.find(t => t.student.id === reviewing.id) ?? null} projection={workspace.projections.get(reviewing.id) ?? null} grades={workspace.grades.filter(grade => Number(grade.studentId) === Number(reviewing.id))} subjects={workspace.subjects} courseAverage={workspace.summary.average} courseId={workspace.course?.id ?? null} onClose={() => setReviewing(null)} onMessage={() => { setMessageFor(reviewing); setReviewing(null) }} onStart={mode => startWorkshop({ mode, level: reviewing.level, student: reviewing, autoStart: true })} />}
    {messageFor && course && <MessageDialog courseId={course.id} student={messageFor} onClose={() => setMessageFor(null)} />}
    {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    {showWelcome && <Tour navigate={navigate} onClose={closeWelcome} />}
    <Spotlight />
    {!showWelcome && <Guide userId={user.id} route={route} params={params} navigate={navigate} onQuickTour={() => setShowWelcome(true)}
      signals={{ courses: courses.length, students: workspace.students.length, columns: workspace.insights.length > 0, workshops: workspace.workshops.length, hasCourse: !!course }} />}
    <Buho context={buhoContext} onAction={runAction} open={buhoOpen} setOpen={setBuhoOpen} briefToken={briefToken} />
  </div>
}

const NO_COURSE_COPY: Record<string, { title: string; text: string }> = {
  students: { title: 'Aquí vivirá la lista de tu curso', text: 'Después de crear el curso importas tu lista y tus notas desde Excel, o agregas estudiantes uno a uno.' },
  'follow-up': { title: 'Aquí verás a quién apoyar', text: 'Con las notas cargadas, FairTeam separa quién necesita refuerzo, quién va bajando y en qué tema.' },
  workshops: { title: 'Aquí prepararás talleres y quizzes', text: 'Eliges un tema, el Búho propone la actividad y tú la revisas antes de descargarla.' },
  rubrics: { title: 'Aquí armarás tus rúbricas', text: 'Describes la actividad, ajustas los criterios y la nota llega sola al libro de notas.' },
  teams: { title: 'Aquí formarás equipos equilibrados', text: 'Con los niveles de tu lista, propone equipos donde todos aportan y aprenden.' },
}

function NoCourse({ route, onCreate, onDemo }: { route: string; onCreate: () => void; onDemo: () => Promise<void> }) {
  const copy = NO_COURSE_COPY[route] ?? { title: 'Primero crea un curso', text: 'Tus estudiantes, notas y materiales se guardan dentro de cada curso.' }
  return <section className="page"><div className="empty empty-page">
    <span className="empty-icon" aria-hidden><FolderOpen size={22} /></span>
    <strong>{copy.title}</strong>
    <p>{copy.text}</p>
    <p className="empty-next">Primer paso: crea un curso, o carga los de demostración para explorar.</p>
    <div className="empty-action button-row"><button className="btn btn-primary" onClick={onCreate}>Crear curso</button><DemoButton onLoaded={onDemo} /></div>
  </div></section>
}

export type PageProps = {
  workspace: ReturnType<typeof useWorkspace>
  navigate: ReturnType<typeof useRouter>['navigate']
  startWorkshop: (intent: WorkshopIntent) => void
  review: (student: Candidate) => void
  assistant: { brief: () => void; report: () => void; message: (student: Candidate) => void; open: () => void }
}
