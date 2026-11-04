import { BookOpenCheck, ChevronsUpDown, FolderOpen, Home, LogOut, Settings, Users, UsersRound, Activity, X } from 'lucide-react'
import type { Course, TeacherProfile } from '../api'
import FairTeamMark from '../FairTeamMark'
import type { Navigate, Route } from '../app/router'

export const nav: { route: Route; label: string; icon: typeof Home; needsCourse?: boolean }[] = [
  { route: 'inicio', label: 'Inicio', icon: Home },
  { route: 'estudiantes', label: 'Estudiantes y notas', icon: Users, needsCourse: true },
  { route: 'seguimiento', label: 'Seguimiento', icon: Activity, needsCourse: true },
  { route: 'talleres', label: 'Talleres y quizzes', icon: BookOpenCheck, needsCourse: true },
  { route: 'equipos', label: 'Equipos', icon: UsersRound, needsCourse: true },
]

type SidebarProps = {
  route: Route; navigate: Navigate; user: TeacherProfile; onLogout: () => void
  course: Course | null; courses: Course[]; coursesLoading: boolean; setCourseId: (id: number | null) => void
  lowCount: number; menuOpen: boolean; closeMenu: () => void; buhoOpen: boolean; toggleBuho: () => void
}

/** Navigation, course switcher, the Búho launcher and the signed-in teacher. */
export default function Sidebar({ route, navigate, user, onLogout, course, courses, coursesLoading, setCourseId, lowCount, menuOpen, closeMenu, buhoOpen, toggleBuho }: SidebarProps) {
  return <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Menú principal">
    <div className="sidebar-brand">
      <FairTeamMark size={30} />
      <span className="wordmark" translate="no">FairTeam</span>
      <button className="icon-btn sidebar-close" onClick={closeMenu} aria-label="Cerrar menú"><X size={18} /></button>
    </div>

    <label className="course-picker">
      <span className="course-picker-label">Curso</span>
      <span className="course-picker-box">
        <FolderOpen size={16} aria-hidden />
        <select title={course?.name} value={course?.id ?? ''} onChange={event => { if (event.target.value === 'nuevo') { navigate('cursos', { nuevo: '1' }); return } setCourseId(event.target.value ? Number(event.target.value) : null) }} aria-label="Curso activo">
          {!courses.length && <option value="">{coursesLoading ? 'Cargando…' : 'Sin cursos'}</option>}
          {courses.map(item => <option key={item.id} value={item.id}>{item.name}{item.period ? ` · ${item.period}` : ''}</option>)}
          <option value="nuevo">+ Crear curso nuevo</option>
        </select>
        <ChevronsUpDown size={15} aria-hidden />
      </span>
    </label>

    <button className={`buho-nav${buhoOpen ? ' is-on' : ''}`} onClick={toggleBuho} aria-expanded={buhoOpen}>
      <span className="buho-nav-orb" aria-hidden><FairTeamMark size={26} /></span>
      <span><b>Búho</b><small>Tu asistente</small></span>
      <kbd aria-hidden>Ctrl K</kbd>
    </button>

    <nav className="nav">
      {nav.map(item => {
        const Icon = item.icon
        const badge = item.route === 'seguimiento' && lowCount ? lowCount : null
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
}
