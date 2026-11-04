import type { Grade } from '../api'
import { formatGrade, type Candidate, type Subject } from './domain'

export const PASSING = 3

/** Periods sorted the way teachers write them: "Corte 1" < "Corte 2" < "Corte 3"; otherwise first-seen order. */
export function orderedPeriods(grades: Grade[]): string[] {
  const seen: string[] = []
  for (const grade of grades) { const p = (grade.period || '').trim() || 'Sin periodo'; if (!seen.includes(p)) seen.push(p) }
  const num = (p: string) => { const m = p.match(/(\d+)(?!.*\d)/); return m ? Number(m[1]) : NaN }
  if (seen.every(p => Number.isFinite(num(p)))) return [...seen].sort((a, b) => num(a) - num(b))
  return seen
}

export type Trend = {
  student: Candidate
  points: { period: string; average: number }[]
  delta: number | null
  direction: 'down' | 'up' | 'flat' | 'unknown'
  risk: number
  weakest: { name: string; average: number } | null
  bySubject: { name: string; average: number }[]
}

/** Per-student evolution across periods plus a 0–100 risk score that blends level and trend. */
export function studentTrends(candidates: Candidate[], grades: Grade[], subjects: Subject[]): Trend[] {
  const periods = orderedPeriods(grades)
  const names = new Map(subjects.map(s => [Number(s.id), s.name]))
  return candidates.map(student => {
    const own = grades.filter(g => Number(g.studentId) === Number(student.id) && Number.isFinite(Number(g.grade)))
    const points = periods.map(period => {
      const marks = own.filter(g => ((g.period || '').trim() || 'Sin periodo') === period).map(g => Number(g.grade))
      return marks.length ? { period, average: marks.reduce((s, m) => s + m, 0) / marks.length } : null
    }).filter((p): p is { period: string; average: number } => p !== null)
    const delta = points.length >= 2 ? points[points.length - 1].average - points[0].average : null
    const direction: Trend['direction'] = delta == null ? 'unknown' : delta <= -0.3 ? 'down' : delta >= 0.3 ? 'up' : 'flat'
    const bySubject = new Map<number, number[]>()
    for (const g of own) { const id = Number(g.subjectId); bySubject.set(id, [...(bySubject.get(id) ?? []), Number(g.grade)]) }
    const subjectAverages = [...bySubject.entries()].map(([id, list]) => ({ name: names.get(id) ?? `Materia ${id}`, average: list.reduce((s, m) => s + m, 0) / list.length })).sort((a, b) => a.average - b.average)
    const weakestEntry = subjectAverages[0] ?? null
    let risk = 0
    if (student.hasGrades) {
      risk = Math.max(0, Math.min(100, (4.2 - student.average) * 45))
      if (direction === 'down') risk += Math.min(30, Math.abs(delta!) * 30)
      if (direction === 'up') risk -= 10
    } else risk = 35
    return { student, points, delta, direction, risk: Math.round(Math.max(0, Math.min(100, risk))), weakest: weakestEntry, bySubject: subjectAverages }
  }).sort((a, b) => b.risk - a.risk)
}

export type SimulatorConfig = { weights: number[] }
export function defaultWeights(periodCount: number): number[] {
  if (periodCount === 3) return [30, 30, 40]
  if (periodCount <= 1) return [100]
  return Array.from({ length: periodCount }, () => Math.round(100 / periodCount))
}

export type Projection = {
  student: Candidate
  completed: { period: string; average: number; weight: number }[]
  remainingWeight: number
  current: number
  needed: number | null
  status: 'passed' | 'possible' | 'hard' | 'impossible' | 'no-data'
}

/**
 * With weighted periods (e.g. 30/30/40), the grade a student needs in the remaining
 * periods to reach the passing mark. Periods with no grade yet count as remaining.
 */
export function project(trend: Trend, periods: string[], weights: number[], passing = PASSING): Projection {
  const totalWeight = weights.slice(0, periods.length).reduce((s, w) => s + w, 0) || 100
  const completed = periods.map((period, i) => {
    const point = trend.points.find(p => p.period === period)
    return point ? { period, average: point.average, weight: (weights[i] ?? 0) / totalWeight } : null
  }).filter((c): c is { period: string; average: number; weight: number } => c !== null)
  const earned = completed.reduce((s, c) => s + c.average * c.weight, 0)
  const doneWeight = completed.reduce((s, c) => s + c.weight, 0)
  const remainingWeight = Math.max(0, 1 - doneWeight)
  if (!completed.length) return { student: trend.student, completed, remainingWeight, current: 0, needed: null, status: 'no-data' }
  const current = doneWeight ? earned / doneWeight : 0
  if (remainingWeight < 0.001) return { student: trend.student, completed, remainingWeight: 0, current: earned, needed: null, status: earned >= passing ? 'passed' : 'impossible' }
  const needed = (passing - earned) / remainingWeight
  const status = needed <= 0 ? 'passed' : needed <= 3.5 ? 'possible' : needed <= 5 ? 'hard' : 'impossible'
  return { student: trend.student, completed, remainingWeight, current, needed: Math.max(0, needed), status }
}

export function projectionText(p: Projection) {
  if (p.status === 'no-data') return 'Sin notas todavía.'
  if (p.status === 'passed') return p.remainingWeight ? 'Ya tiene asegurado el 3,0 aunque saque 0 en lo que falta.' : `Aprobó con ${formatGrade(p.current)}.`
  if (p.status === 'impossible') return p.remainingWeight ? `Necesitaría ${formatGrade(p.needed!)} en lo que falta: ya no alcanza el 3,0.` : `Terminó con ${formatGrade(p.current)}.`
  return `Necesita ${formatGrade(p.needed!)} en lo que falta para llegar a 3,0.`
}
