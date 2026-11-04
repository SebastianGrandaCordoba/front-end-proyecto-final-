import { describe, expect, it } from 'vitest'
import type { Grade, Student } from '../../api'
import { buildCandidates, summarize } from '../domain'

const students: Student[] = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Luis' }, { id: 3, name: 'Eva', academicLevel: 'LOW' }]
const grades: Grade[] = [
  { id: 1, studentId: 1, subjectId: 1, grade: 2.0, period: 'Corte 1' },
  { id: 2, studentId: 1, subjectId: 2, grade: '3.0', period: 'Corte 1' },
  { id: 3, studentId: 2, subjectId: 1, grade: 4.5, period: 'Corte 1' },
]

describe('candidates', () => {
  it('averages only the grades actually loaded', () => {
    const [ana, luis, eva] = buildCandidates(students, grades)
    expect(ana.average).toBe(2.5)
    expect(ana.level).toBe('LOW')
    expect(luis.level).toBe('HIGH')
    expect(eva.hasGrades).toBe(false)
    expect(Number.isNaN(eva.average)).toBe(true)
    expect(eva.level).toBe('LOW')
  })

  it('summarizes only graded students by level', () => {
    const summary = summarize(buildCandidates(students, grades), grades)
    expect(summary).toMatchObject({ students: 3, graded: 2, ungraded: 1, low: 1, medium: 0, high: 1, gradeCount: 3 })
    expect(summary.average).toBeCloseTo(3.1667, 3)
  })
})
