import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { request, type Course, type CourseMaterial, type GeneratedWorkshop, type Grade, type Project, type Student, type Team, type TeacherProfile } from '../api'
import { buildCandidates, subjectInsights, summarize, type Subject } from '../lib/domain'
import { defaultWeights, orderedPeriods, project, studentTrends } from '../lib/insights'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked: keep working in memory */ }
}

/** All course data in one place, loaded in parallel and cached per course for instant switching. */
export function useWorkspace(user: TeacherProfile) {
  const courseKey = `fairteam.activeCourse.${user.id}`
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesState, setCoursesState] = useState<LoadState>('loading')
  const [courseId, setCourseIdState] = useState<number | null>(() => {
    const stored = Number(localStorage.getItem(courseKey))
    return Number.isInteger(stored) && stored > 0 ? stored : null
  })
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [materials, setMaterials] = useState<CourseMaterial[] | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [courseState, setCourseState] = useState<LoadState>('idle')
  const generation = useRef(0)
  const cache = useRef(new Map<number, { students: Student[]; grades: Grade[]; materials: CourseMaterial[] | null }>())

  const workshopKey = `fairteam.workshops.${user.id}.${courseId ?? 'none'}`
  const [workshops, setWorkshops] = useState<GeneratedWorkshop[]>(() => readJson(workshopKey, []))
  const loadedWorkshopKey = useRef(workshopKey)
  useEffect(() => {
    const legacy = readJson<GeneratedWorkshop[] | null>(`fairteam.workshops.${user.id}`, null)
    setWorkshops(readJson(workshopKey, legacy ?? []))
    loadedWorkshopKey.current = workshopKey
  }, [workshopKey, user.id])
  useEffect(() => { if (loadedWorkshopKey.current === workshopKey) writeJson(workshopKey, workshops) }, [workshops, workshopKey])

  const setCourseId = useCallback((id: number | null) => {
    setCourseIdState(id)
    if (id) localStorage.setItem(courseKey, String(id)); else localStorage.removeItem(courseKey)
  }, [courseKey])

  const loadCourses = useCallback(async () => {
    setCoursesState('loading')
    try {
      const items = await request<Course[]>('/api/courses')
      setCourses(items)
      setCoursesState('ready')
      setCourseIdState(current => {
        const next = items.some(item => item.id === current) ? current : items[0]?.id ?? null
        if (next) localStorage.setItem(courseKey, String(next)); else localStorage.removeItem(courseKey)
        return next
      })
    } catch { setCoursesState('error') }
  }, [courseKey])

  const loadCourse = useCallback(async (id: number | null, { silent = false } = {}) => {
    const current = ++generation.current
    if (!id) { setStudents([]); setGrades([]); setMaterials(null); setCourseState('idle'); return }
    const cached = cache.current.get(id)
    if (cached) { setStudents(cached.students); setGrades(cached.grades); setMaterials(cached.materials) }
    else if (!silent) { setStudents([]); setGrades([]); setMaterials(null) }
    if (!cached && !silent) setCourseState('loading')
    const [s, g, m] = await Promise.allSettled([
      request<Student[]>(`/api/students?courseId=${id}`),
      request<Grade[]>(`/api/grades?courseId=${id}`),
      request<CourseMaterial[]>(`/api/courses/${id}/materials`),
    ])
    if (current !== generation.current) return
    const next = {
      students: s.status === 'fulfilled' ? s.value : cached?.students ?? [],
      grades: g.status === 'fulfilled' ? g.value : cached?.grades ?? [],
      materials: m.status === 'fulfilled' ? m.value : cached?.materials ?? null,
    }
    cache.current.set(id, next)
    setStudents(next.students); setGrades(next.grades); setMaterials(next.materials)
    setCourseState(s.status === 'rejected' && g.status === 'rejected' ? 'error' : 'ready')
  }, [])

  const loadShared = useCallback(async () => {
    const [p, t, sub] = await Promise.allSettled([
      request<Project[]>('/api/projects'),
      request<Team[]>('/api/teams'),
      request<Subject[]>('/api/subjects'),
    ])
    if (p.status === 'fulfilled') setProjects(p.value)
    if (t.status === 'fulfilled') setTeams(t.value)
    if (sub.status === 'fulfilled') setSubjects(sub.value)
  }, [])

  useEffect(() => { void loadCourses(); void loadShared() }, [loadCourses, loadShared])
  useEffect(() => { if (coursesState === 'ready') void loadCourse(courseId) }, [courseId, coursesState, loadCourse])

  const refreshCourse = useCallback(() => loadCourse(courseId, { silent: true }), [courseId, loadCourse])
  const refreshAll = useCallback(async () => { await Promise.all([loadCourse(courseId, { silent: true }), loadShared()]) }, [courseId, loadCourse, loadShared])

  const updateMaterials = useCallback((update: (list: CourseMaterial[]) => CourseMaterial[]) => {
    setMaterials(list => {
      const next = update(list ?? [])
      if (courseId) { const cached = cache.current.get(courseId); if (cached) cache.current.set(courseId, { ...cached, materials: next }) }
      return next
    })
  }, [courseId])

  const saveWorkshop = useCallback((workshop: GeneratedWorkshop) => {
    const stamped = { ...workshop, savedAt: new Date().toISOString() }
    setWorkshops(list => [stamped, ...list.filter(item => item.title !== workshop.title)].slice(0, 30))
    return stamped
  }, [])
  const removeWorkshop = useCallback((title: string) => setWorkshops(list => list.filter(item => item.title !== title)), [])
  const clearWorkshops = useCallback(() => setWorkshops([]), [])

  const candidates = useMemo(() => buildCandidates(students, grades), [students, grades])
  const summary = useMemo(() => summarize(candidates, grades), [candidates, grades])
  const insights = useMemo(() => subjectInsights(grades, subjects), [grades, subjects])
  const course = courses.find(item => item.id === courseId) ?? null

  // Grade simulator: how many periods the course has and how much each weighs (30/30/40 by default).
  const simKey = `fairteam.sim.${user.id}.${courseId ?? 'none'}`
  const observed = useMemo(() => orderedPeriods(grades), [grades])
  const [simConfig, setSimConfigState] = useState<{ total: number; weights: number[] } | null>(() => readJson(simKey, null))
  useEffect(() => { setSimConfigState(readJson(simKey, null)) }, [simKey])
  const sim = useMemo(() => {
    const total = Math.max(simConfig?.total ?? 3, observed.length, 1)
    const weights = simConfig?.weights?.length === total ? simConfig.weights : defaultWeights(total)
    const periods = [...observed, ...Array.from({ length: Math.max(0, total - observed.length) }, (_, i) => `Corte ${observed.length + i + 1}`)]
    return { total, weights, periods, observed }
  }, [simConfig, observed])
  const setSimConfig = useCallback((next: { total: number; weights: number[] }) => { setSimConfigState(next); writeJson(simKey, next) }, [simKey])
  const trends = useMemo(() => studentTrends(candidates, grades, subjects), [candidates, grades, subjects])
  const projections = useMemo(() => new Map(trends.map(t => [t.student.id, project(t, sim.periods, sim.weights)])), [trends, sim])

  return {
    courses, setCourses, coursesState, loadCourses,
    course, courseId, setCourseId, courseState,
    students, grades, candidates, summary, insights, subjects,
    trends, projections, sim, setSimConfig,
    materials, updateMaterials,
    projects, teams,
    workshops, saveWorkshop, removeWorkshop, clearWorkshops,
    refreshCourse, refreshAll, loadShared,
  }
}

export type Workspace = ReturnType<typeof useWorkspace>
