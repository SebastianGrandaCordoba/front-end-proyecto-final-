import { Fragment } from 'react'
import { BookOpenCheck, ChevronsUpDown, ClipboardCheck, FolderOpen, Home, LogOut, Settings, Users, UsersRound, Activity, X } from 'lucide-react'
import type { Course, TeacherProfile } from '../api'
import FairTeamMark from '../FairTeamMark'
import type { Navigate, Route } from '../app/router'

/** `group` starts a labelled block: the menu reads in the order a teacher works (see the course, then prepare and grade). */
export const nav: { route: Route; label: string; icon: typeof Home; needsCourse?: boolean; group?: string }[] = [
  { route: 'home', label: 'Inicio', icon: Home },
  { route: 'students', label: 'Estudiantes y notas', icon: Users, needsCourse: true, group: 'Tu curso' },
  { route: 'follow-up', label: 'Seguimiento', icon: Activity, needsCourse: true },
  { route: 'workshops', label: 'Talleres y quizzes', icon: BookOpenCheck, needsCourse: true, group: 'Preparar y calificar' },
  { route: 'rubrics', label: 'Rúbricas', icon: ClipboardCheck, needsCourse: true },
  { route: 'teams', label: 'Equipos', icon: UsersRound, needsCourse: true },
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
        <select title={course?.name} value={course?.id ?? ''} onChange={event => { if (event.target.value === 'new') { navigate('courses', { new: '1' }); return } setCourseId(event.target.value ? Number(event.target.value) : null) }} aria-label="Curso activo">
          {!courses.length && <option value="">{coursesLoading ? 'Cargando…' : 'Sin cursos'}</option>}
          {courses.map(item => <option key={item.id} value={item.id}>{item.name}{item.period ? ` · ${item.period}` : ''}</option>)}
          <option value="new">+ Crear curso nuevo</option>
        </select>
        <ChevronsUpDown size={15} aria-hidden />
      </span>
    </label>

    <button data-tour="buho" className={`buho-nav${buhoOpen ? ' is-on' : ''}`} onClick={toggleBuho} aria-expanded={buhoOpen}>
      <span className="buho-nav-orb" aria-hidden><FairTeamMark size={26} /></span>
      <span><b>Búho</b><small>Tu asistente</small></span>
      <kbd aria-hidden>Ctrl K</kbd>
    </button>

    <nav className="nav">
      {nav.map(item => {
        const Icon = item.icon
        const badge = item.route === 'follow-up' && lowCount ? lowCount : null
        return <Fragment key={item.route}>
          {item.group && <span className="nav-group">{item.group}</span>}
          <a href={`#/${item.route}`} className={`nav-item${route === item.route ? ' is-active' : ''}`} aria-current={route === item.route ? 'page' : undefined}>
            <Icon size={18} aria-hidden /><span>{item.label}</span>
            {badge != null && <span className="nav-badge" aria-label={`${badge} en refuerzo`}>{badge}</span>}
          </a>
        </Fragment>
      })}
    </nav>

    <div className="nav nav-secondary">
      <a href="#/courses" className={`nav-item${route === 'courses' ? ' is-active' : ''}`} aria-current={route === 'courses' ? 'page' : undefined}><FolderOpen size={18} aria-hidden /><span>Mis cursos</span></a>
      <a href="#/settings" className={`nav-item${route === 'settings' ? ' is-active' : ''}`} aria-current={route === 'settings' ? 'page' : undefined}><Settings size={18} aria-hidden /><span>Ajustes</span></a>
    </div>

    <div className="sidebar-user" data-tour="perfil">
      <span className="user-initials" aria-hidden>{user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
      <span className="user-meta"><b>{user.name}</b><small>{user.email}</small></span>
      <button className="icon-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button>
    </div>
  </aside>
}
