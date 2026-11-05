import { describe, expect, it } from 'vitest'
import type { Course } from '../../api'
import { groupBySemester } from '../semesters'

const course = (id: number, period?: string) => ({ id, name: `C${id}`, period }) as Course

describe('groupBySemester', () => {
  it('orders semesters newest first and marks the current one', () => {
    const groups = groupBySemester([course(1, '2025-2'), course(2, '2026-2'), course(3, '2026-1'), course(4, '2026-2')])
    expect(groups.map(g => g.period)).toEqual(['2026-2', '2026-1', '2025-2'])
    expect(groups[0]).toMatchObject({ current: true, label: 'Semestre 2026-2 · actual' })
    expect(groups[0].courses.map(c => c.id)).toEqual([2, 4])
  })
  it('puts courses without period at the end', () => {
    expect(groupBySemester([course(1), course(2, '2026-1')]).map(g => g.label)).toEqual(['Semestre 2026-1 · actual', 'Sin periodo'])
  })
})
