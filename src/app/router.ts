import { useCallback, useEffect, useState } from 'react'

export type Route = 'inicio' | 'estudiantes' | 'seguimiento' | 'talleres' | 'equipos' | 'cursos' | 'ajustes'
const routes: Route[] = ['inicio', 'estudiantes', 'seguimiento', 'talleres', 'equipos', 'cursos', 'ajustes']

export type Location = { route: Route; params: URLSearchParams }

/** Reads a hash like "#/seguimiento?vista=simulador"; unknown routes go home. */
export function parseHash(hash: string): Location {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const route = routes.includes(path as Route) ? path as Route : 'inicio'
  return { route, params: new URLSearchParams(query) }
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
