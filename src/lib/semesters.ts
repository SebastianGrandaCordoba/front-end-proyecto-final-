import type { Course } from '../api'

export interface SemesterGroup { period: string; label: string; current: boolean; courses: Course[] }

/** Groups courses by period, newest first ("2026-2" before "2026-1"); courses without period go last. */
export function groupBySemester(courses: Course[]): SemesterGroup[] {
  const groups = new Map<string, Course[]>()
  for (const course of courses) {
    const key = course.period?.trim() || ''
    groups.set(key, [...(groups.get(key) ?? []), course])
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a, 'es', { numeric: true })))
  const newest = keys.find(key => key !== '')
  return keys.map(key => ({
    period: key,
    label: key === '' ? 'Sin periodo' : key === newest ? `Semestre ${key} · actual` : `Semestre ${key}`,
    current: key !== '' && key === newest,
    courses: groups.get(key)!,
  }))
}
