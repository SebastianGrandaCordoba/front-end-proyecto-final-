import { describe, expect, it } from 'vitest'
import { activityFromWorkshop, blankRubric, rubricGrade, weightSum } from '../rubrics'

const criteria = [{ id: 1, weight: 40 }, { id: 2, weight: 40 }, { id: 3, weight: 20 }]

describe('rubric grades', () => {
  it('matches the backend: Básico everywhere is the passing grade', () => {
    expect(rubricGrade(criteria, { 1: 2, 2: 2, 3: 2 }, 5)).toBe(3)
    expect(rubricGrade(criteria, { 1: 2, 2: 2, 3: 2 }, 100)).toBe(60)
  })

  it('weights each criterion', () => {
    expect(rubricGrade(criteria, { 1: 0, 2: 1, 3: 3 }, 5)).toBe(3.9)
  })

  it('waits until every criterion has a level', () => {
    expect(rubricGrade(criteria, { 1: 0 }, 5)).toBeNull()
    expect(rubricGrade([], {}, 5)).toBeNull()
  })
})

describe('rubric drafts', () => {
  it('starts from a template that already adds up to 100 %', () => {
    expect(weightSum(blankRubric().criteria)).toBe(100)
  })

  it('describes a saved workshop for the AI', () => {
    const text = activityFromWorkshop({ title: 'Taller Observer', summary: 'Practica Observer.', learningObjectives: ['Implementar Observer'],
      activities: [{ title: 'Código', instructions: '1. Crea la interfaz', deliverable: 'Repositorio' }] })
    expect(text).toContain('Actividad: Taller Observer')
    expect(text).toContain('Entrega: Repositorio')
  })
})
