import { useCallback, useEffect, useState } from 'react'

export type Route = 'home' | 'students' | 'follow-up' | 'workshops' | 'rubrics' | 'teams' | 'courses' | 'settings'
const routes: Route[] = ['home', 'students', 'follow-up', 'workshops', 'rubrics', 'teams', 'courses', 'settings']

/** Addresses saved before the English rename keep working. */
const LEGACY_ROUTES: Record<string, Route> = { inicio: 'home', estudiantes: 'students', seguimiento: 'follow-up', talleres: 'workshops', rubricas: 'rubrics', equipos: 'teams', cursos: 'courses', ajustes: 'settings' }
const LEGACY_VALUES: Record<string, string> = { prioridad: 'priority', tendencia: 'trend', mapa: 'map', simulador: 'simulator', notas: 'grades', lista: 'list', asistencia: 'attendance', rubrica: 'rubric', evaluar: 'grade', todos: 'all', refuerzo: 'support', seguimiento: 'watch', progreso: 'progress', 'sin-notas': 'ungraded' }
const LEGACY_PARAMS: Record<string, string> = { vista: 'view', filtro: 'filter', nuevo: 'new', ver: 'open', taller: 'workshop' }

export type Location = { route: Route; params: URLSearchParams }

/** Reads a hash like "#/follow-up?view=simulator"; unknown routes go home. */
export function parseHash(hash: string): Location {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const route = routes.includes(path as Route) ? path as Route : LEGACY_ROUTES[path] ?? 'home'
  const params = new URLSearchParams()
  new URLSearchParams(query).forEach((value, key) => {
    const name = LEGACY_PARAMS[key] ?? key
    params.set(name, name === 'view' || name === 'filter' ? LEGACY_VALUES[value] ?? value : value)
  })
  return { route, params }
}

const parse = () => parseHash(window.location.hash)

/** Hash routing: the back button works, a reload keeps the page and any screen can be linked. */
export function useRouter() {
  const [location, setLocation] = useState<Location>(parse)
  useEffect(() => {
    const onChange = () => setLocation(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback((route: Route, params?: Record<string, string>) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const hash = `#/${route}${query ? `?${query}` : ''}`
    if (window.location.hash !== hash) window.location.hash = hash
    else setLocation(parse())
    document.querySelector('.sheet')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [])
  return { ...location, navigate }
}

export type Navigate = ReturnType<typeof useRouter>['navigate']
