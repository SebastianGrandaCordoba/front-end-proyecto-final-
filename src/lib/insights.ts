import type { AcademicLevel } from '../api'
import type { Candidate, CourseSummary, SubjectInsight } from './domain'

/* The analysis is computed by the backend (insights module, Spring Boot). This file only
   describes its JSON and adapts it to the shapes the screens render. */

type ApiStudent = { id: number; name: string; email: string | null; profileLevel: string | null }
type ApiPeriod = { period: string; average: number }
type ApiSubject = { subjectId: number; name: string; average: number; count: number; studentsBelowPassing: number }
type ApiLevel = AcademicLevel | 'NO_DATA'
type ApiPerformance = { student: ApiStudent; average: number | null; gradeCount: number; level: ApiLevel; periods: ApiPeriod[]; delta: number | null; direction: 'DOWN' | 'UP' | 'FLAT' | 'UNKNOWN'; risk: number; subjects: ApiSubject[] }
type ApiProjection = { studentId: number; studentName: string; earned: number; current: number; remainingWeight: number; needed: number | null; status: 'PASSED' | 'POSSIBLE' | 'HARD' | 'IMPOSSIBLE' | 'NO_DATA'; explanation: string }
export type ApiInsights = {
  analysis: { courseId: number; courseName: string; summary: CourseSummary & { fallingBehind: number }; periods: string[]; subjects: ApiSubject[]; students: ApiPerformance[] }
  scheme: { weights: number[]; passingGrade: number; periods: string[]; observedPeriods: string[]; custom: boolean }
  projections: ApiProjection[]
  briefing: string
}

export type Trend = {
  student: Candidate
  points: ApiPeriod[]
  delta: number | null
  direction: 'down' | 'up' | 'flat' | 'unknown'
  risk: number
  weakest: { name: string; average: number } | null
  bySubject: { name: string; average: number }[]
}
export type Projection = {
  student: Candidate
  earned: number
  current: number
  remainingWeight: number
  needed: number | null
  status: 'passed' | 'possible' | 'hard' | 'impossible' | 'no-data'
  explanation: string
}
export type Sim = { weights: number[]; passingGrade: number; periods: string[]; observed: string[]; custom: boolean }

export type Insights = {
  candidates: Candidate[]
  summary: CourseSummary & { fallingBehind: number }
  subjects: SubjectInsight[]
  trends: Trend[]
  projections: Map<number, Projection>
  sim: Sim
  briefing: string
}

/** Turns the backend's reading into the view models; students keep their roster data (email, course). */
export function adaptInsights(api: ApiInsights, roster: Candidate[]): Insights {
  const byId = new Map(roster.map(student => [student.id, student]))
  const candidates: Candidate[] = api.analysis.students.map(p => {
    const base = byId.get(p.student.id)
    const hasGrades = p.gradeCount > 0
    return {
      ...(base ?? { id: p.student.id, name: p.student.name, email: p.student.email }),
      average: hasGrades && p.average != null ? p.average : NaN,
      gradeCount: p.gradeCount,
      hasGrades,
      level: p.level === 'NO_DATA' ? 'MEDIUM' : p.level,
    }
  })
  const candidateById = new Map(candidates.map(c => [c.id, c]))
  const trends: Trend[] = api.analysis.students.map(p => ({
    student: candidateById.get(p.student.id)!,
    points: p.periods,
    delta: p.delta,
    direction: p.direction.toLowerCase() as Trend['direction'],
    risk: p.risk,
    weakest: p.subjects[0] ? { name: p.subjects[0].name, average: p.subjects[0].average } : null,
    bySubject: p.subjects.map(s => ({ name: s.name, average: s.average })),
  }))
  const projections = new Map<number, Projection>()
  for (const p of api.projections) {
    const student = candidateById.get(p.studentId)
    if (!student) continue
    projections.set(p.studentId, { student, earned: p.earned, current: p.current, remainingWeight: p.remainingWeight, needed: p.needed, status: p.status.toLowerCase().replace('_', '-') as Projection['status'], explanation: p.explanation })
  }
  return {
    candidates: [...candidates].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    summary: api.analysis.summary,
    subjects: api.analysis.subjects.map(s => ({ id: s.subjectId, name: s.name, average: s.average, count: s.count, lowCount: s.studentsBelowPassing })),
    trends,
    projections,
    sim: { weights: api.scheme.weights, passingGrade: api.scheme.passingGrade, periods: api.scheme.periods, observed: api.scheme.observedPeriods, custom: api.scheme.custom },
    briefing: api.briefing,
  }
}
