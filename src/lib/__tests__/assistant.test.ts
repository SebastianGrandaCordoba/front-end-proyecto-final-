import { describe, expect, it } from 'vitest'
import type { Course } from '../../api'
import { headline, recommendations, setupSteps, type AssistantInput } from '../assistant'
import type { Candidate, CourseSummary } from '../domain'

const course: Course = { id: 1, name: 'Programación I' }
const empty: CourseSummary = { students: 0, graded: 0, ungraded: 0, low: 0, medium: 0, high: 0, average: null, gradeCount: 0 }
const input = (over: Partial<AssistantInput> = {}): AssistantInput => ({ course, courses: [course], candidates: [], summary: empty, materials: [], workshops: [], weakest: null, ...over })

describe('home assistant', () => {
  it('starts by asking for a course', () => {
    const recs = recommendations(input({ course: null, courses: [] }))
    expect(recs).toHaveLength(1)
    expect(recs[0].action.kind).toBe('create-course')
    expect(headline(input({ course: null }))).toBe('Empecemos creando tu primer curso.')
  })

  it('asks for the roster, then the grades', () => {
    expect(recommendations(input())[0].action.kind).toBe('import-roster')
    const withStudents = input({ summary: { ...empty, students: 5, ungraded: 5 } })
    expect(recommendations(withStudents)[0].action.kind).toBe('import-grades')
  })

  it('prioritizes reinforcement and asks for material first when there is none', () => {
    const lowStudent = { id: 1, name: 'Ana', hasGrades: true, level: 'LOW', average: 2.1, gradeCount: 3 } as Candidate
    const summary = { ...empty, students: 1, graded: 1, low: 1, gradeCount: 3, average: 2.1 }
    const recs = recommendations(input({ summary, candidates: [lowStudent], materials: [] }))
    const support = recs.find(r => r.id === 'support')!
    expect(support.tone).toBe('urgent')
    expect(support.action.kind).toBe('upload-material')
    expect(support.detail).toContain('Ana')
  })

  it('tracks the setup checklist', () => {
    const steps = setupSteps(input({ summary: { ...empty, students: 3, gradeCount: 4 } }))
    expect(steps.map(s => s.done)).toEqual([true, true, true, false])
  })
})
