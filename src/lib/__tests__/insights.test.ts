import { describe, expect, it } from 'vitest'
import { adaptInsights, type ApiInsights } from '../insights'
import type { Candidate } from '../domain'

const api: ApiInsights = {
  analysis: {
    courseId: 1, courseName: 'Física',
    summary: { students: 2, graded: 1, ungraded: 1, low: 1, medium: 0, high: 0, average: 2.4, gradeCount: 2, fallingBehind: 1 },
    periods: ['Corte 1', 'Corte 2'],
    subjects: [{ subjectId: 3, name: 'Cinemática', average: 2.4, count: 2, studentsBelowPassing: 1 }],
    students: [
      { student: { id: 1, name: 'Ana Ruiz', email: 'ana@u.co', profileLevel: null }, average: 2.4, gradeCount: 2, level: 'LOW', periods: [{ period: 'Corte 1', average: 2.8 }, { period: 'Corte 2', average: 2.0 }], delta: -0.8, direction: 'DOWN', risk: 90, subjects: [{ subjectId: 3, name: 'Cinemática', average: 2.4, count: 2, studentsBelowPassing: 1 }] },
      { student: { id: 2, name: 'Luis Paz', email: null, profileLevel: 'HIGH' }, average: null, gradeCount: 0, level: 'HIGH', periods: [], delta: null, direction: 'UNKNOWN', risk: 35, subjects: [] },
    ],
  },
  scheme: { weights: [30, 30, 40], passingGrade: 3, periods: ['Corte 1', 'Corte 2', 'Corte 3'], observedPeriods: ['Corte 1', 'Corte 2'], custom: false },
  projections: [{ studentId: 1, studentName: 'Ana Ruiz', earned: 1.44, current: 2.4, remainingWeight: 0.4, needed: 3.9, status: 'HARD', explanation: 'Necesita 3,9 en lo que falta para llegar a 3,0.' }],
  briefing: 'Buenas tardes.',
}

describe('backend insights adapter', () => {
  const roster = [{ id: 1, name: 'Ana Ruiz', email: 'ana@u.co', courseId: 1 }] as Candidate[]
  const reading = adaptInsights(api, roster)

  it('keeps roster data and takes levels from the backend', () => {
    const ana = reading.candidates.find(c => c.id === 1)!
    expect(ana.courseId).toBe(1)
    expect(ana.level).toBe('LOW')
    const luis = reading.candidates.find(c => c.id === 2)!
    expect(luis.hasGrades).toBe(false)
  })

  it('maps trends, projections and the scheme', () => {
    expect(reading.trends[0].direction).toBe('down')
    expect(reading.trends[0].weakest?.name).toBe('Cinemática')
    expect(reading.projections.get(1)?.status).toBe('hard')
    expect(reading.sim.observed).toEqual(['Corte 1', 'Corte 2'])
    expect(reading.subjects[0].lowCount).toBe(1)
  })

  it('sorts students alphabetically for the tables', () => {
    expect(reading.candidates.map(c => c.name)).toEqual(['Ana Ruiz', 'Luis Paz'])
  })
})
