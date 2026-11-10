import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { request, type Course, type CourseMaterial, type GeneratedWorkshop, type Grade, type Project, type Student, type Team, type TeacherProfile } from '../api'
import { buildCandidates, setGradeScale, summarize, type Subject } from '../lib/domain'
import { adaptInsights, type ApiInsights, type Projection, type Trend } from '../lib/insights'
import { fromActivity, toActivity, type ActivityView } from '../lib/activities'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
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
  const cache = useRef(new Map<number, { students: Student[]; grades: Grade[]; materials: CourseMaterial[] | null; analysis: ApiInsights | null }>())
  const [analysis, setAnalysis] = useState<ApiInsights | null>(null)
  const [analysisState, setAnalysisState] = useState<LoadState>('idle')

  // Saved workshops and quizzes live on the server (course_activities) so the grade book, rubrics and Búho
  // see the same list on any device. Ones saved in this browser by older versions are uploaded once.
  const [workshops, setWorkshops] = useState<GeneratedWorkshop[]>([])
  const loadWorkshops = useCallback(async (id: number | null) => {
    if (!id) { setWorkshops([]); return }
    try {
      let items = (await request<ActivityView[]>(`/api/courses/${id}/activities`)).map(fromActivity)
      const legacyKey = `fairteam.workshops.${user.id}.${id}`
      const legacy = readJson<GeneratedWorkshop[]>(legacyKey, [])
      if (legacy.length) {
        const known = new Set(items.map(item => item.title))
        for (const item of legacy.filter(w => !known.has(w.title)).reverse()) {
          try { items = [fromActivity(await request<ActivityView>(`/api/courses/${id}/activities`, { method: 'POST', body: JSON.stringify(toActivity(item)) })), ...items] }
          catch { /* keep going: one bad item should not block the rest */ }
        }
        localStorage.removeItem(legacyKey)
      }
      setWorkshops(items)
    } catch { setWorkshops([]) }
  }, [user.id])
  useEffect(() => { void loadWorkshops(courseId) }, [courseId, loadWorkshops])

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
    if (!id) { setStudents([]); setGrades([]); setMaterials(null); setAnalysis(null); setCourseState('idle'); setAnalysisState('idle'); return }
    const cached = cache.current.get(id)
    if (cached) { setStudents(cached.students); setGrades(cached.grades); setMaterials(cached.materials); setAnalysis(cached.analysis) }
    else if (!silent) { setStudents([]); setGrades([]); setMaterials(null); setAnalysis(null) }
    if (!cached && !silent) setCourseState('loading')
    if (!cached?.analysis) setAnalysisState('loading')
    // The roster and grades feed the tables; the backend's insights module computes levels, trends,
    // projections and the briefing. All four requests run in parallel.
    const [s, g, m, a] = await Promise.allSettled([
      request<Student[]>(`/api/students?courseId=${id}`),
      request<Grade[]>(`/api/grades?courseId=${id}`),
      request<CourseMaterial[]>(`/api/courses/${id}/materials`),
      request<ApiInsights>(`/api/courses/${id}/insights`),
    ])
    if (current !== generation.current) return
    const next = {
      students: s.status === 'fulfilled' ? s.value : cached?.students ?? [],
      grades: g.status === 'fulfilled' ? g.value : cached?.grades ?? [],
      materials: m.status === 'fulfilled' ? m.value : cached?.materials ?? null,
      analysis: a.status === 'fulfilled' ? a.value : cached?.analysis ?? null,
    }
    cache.current.set(id, next)
    setStudents(next.students); setGrades(next.grades); setMaterials(next.materials); setAnalysis(next.analysis)
    setCourseState(s.status === 'rejected' && g.status === 'rejected' ? 'error' : 'ready')
    setAnalysisState(next.analysis ? 'ready' : 'error')
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

  /** Saves (or updates, when it has an id) and returns the stored version with its id. */
  const saveWorkshop = useCallback(async (workshop: GeneratedWorkshop) => {
    if (!courseId) throw new Error('Elige un curso primero.')
    const path = workshop.id ? `/api/courses/${courseId}/activities/${workshop.id}` : `/api/courses/${courseId}/activities`
    const saved = fromActivity(await request<ActivityView>(path, { method: workshop.id ? 'PUT' : 'POST', body: JSON.stringify(toActivity(workshop)) }))
    setWorkshops(list => [saved, ...list.filter(item => item.id !== saved.id)])
    return saved
  }, [courseId])
  const removeWorkshop = useCallback(async (workshop: GeneratedWorkshop) => {
    if (courseId && workshop.id) await request(`/api/courses/${courseId}/activities/${workshop.id}`, { method: 'DELETE' })
    setWorkshops(list => list.filter(item => item !== workshop && (!workshop.id || item.id !== workshop.id)))
  }, [courseId])
  const clearWorkshops = useCallback(async () => {
    for (const item of workshops) await removeWorkshop(item)
  }, [workshops, removeWorkshop])

  const roster = useMemo(() => buildCandidates(students, grades), [students, grades])
  // Backend reading when available; until it arrives the tables use a plain local average.
  const reading = useMemo(() => analysis ? adaptInsights(analysis, roster) : null, [analysis, roster])
  const candidates = reading?.candidates ?? roster
  const localSummary = useMemo(() => ({ ...summarize(roster, grades), fallingBehind: 0 }), [roster, grades])
  const summary = reading?.summary ?? localSummary
  const insights = reading?.subjects ?? []
  const trends: Trend[] = reading?.trends ?? []
  const projections = reading?.projections ?? new Map<number, Projection>()
  const sim = reading?.sim ?? { weights: [30, 30, 40], passingGrade: 3, periods: ['Corte 1', 'Corte 2', 'Corte 3'], observed: [], custom: false }
  const briefing = reading?.briefing ?? ''
  const distribution = reading?.distribution ?? []
  const course = courses.find(item => item.id === courseId) ?? null
  // Every screen formats grades with the open course's scale (0–5, 0–10, 0–100…).
  setGradeScale(course?.maxGrade)

  const saveScheme = useCallback(async (weights: number[]) => {
    if (!courseId) return
    await request(`/api/courses/${courseId}/grading-scheme`, { method: 'PUT', body: JSON.stringify({ weights, passingGrade: 3 }) })
    cache.current.delete(courseId)
    await loadCourse(courseId, { silent: true })
  }, [courseId, loadCourse])

  return {
    courses, setCourses, coursesState, loadCourses,
    course, courseId, setCourseId, courseState,
    students, grades, candidates, summary, insights, subjects,
    trends, projections, sim, saveScheme, briefing, analysisState, distribution,
    materials, updateMaterials,
    projects, teams,
    workshops, saveWorkshop, removeWorkshop, clearWorkshops, loadWorkshops,
    refreshCourse, refreshAll, loadShared,
  }
}

export type Workspace = ReturnType<typeof useWorkspace>
