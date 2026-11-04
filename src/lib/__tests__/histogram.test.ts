import { describe, expect, it } from 'vitest'
import { adaptInsights, type ApiInsights } from '../insights'

describe('distribution', () => {
  it('defaults to no bands when an older backend does not send them', () => {
    const api = { analysis: { courseId: 1, courseName: 'C', summary: { students: 0, graded: 0, ungraded: 0, low: 0, medium: 0, high: 0, average: null, gradeCount: 0, fallingBehind: 0 }, periods: [], subjects: [], students: [] }, scheme: { weights: [100], passingGrade: 3, periods: [], observedPeriods: [], custom: false }, projections: [], briefing: '' } as ApiInsights
    expect(adaptInsights(api, []).distribution).toEqual([])
  })

  it('passes bands through', () => {
    const bands = [{ label: '0–1', from: 0, to: 1, students: 2 }]
    const api = { analysis: { courseId: 1, courseName: 'C', summary: { students: 2, graded: 2, ungraded: 0, low: 2, medium: 0, high: 0, average: 0.5, gradeCount: 2, fallingBehind: 0 }, periods: [], subjects: [], students: [], distribution: bands }, scheme: { weights: [100], passingGrade: 3, periods: [], observedPeriods: [], custom: false }, projections: [], briefing: '' } as ApiInsights
    expect(adaptInsights(api, []).distribution).toBe(bands)
  })
})
