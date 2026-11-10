import { afterEach, describe, expect, it } from 'vitest'
import { formatGrade, levelRule, setGradeScale } from '../domain'
import { evenWeights, fillMissingWeights, parseGrade, parseWeight, passingFor, weightState, weightedAverage } from '../gradeSheet'

afterEach(() => setGradeScale(5))

describe('course scale', () => {
  it('writes grades stored on 0–5 in the course scale', () => {
    setGradeScale(100)
    expect(formatGrade(4)).toBe('80')
    expect(formatGrade(3.54)).toBe('70,8')
    setGradeScale(10)
    expect(formatGrade(3.5)).toBe('7,0')
  })

  it('keeps the passing grade at 60 % of any scale', () => {
    expect(passingFor(5)).toBe(3)
    expect(passingFor(10)).toBe(6)
    expect(passingFor(100)).toBe(60)
    setGradeScale(100)
    expect(levelRule.LOW).toBe('Promedio menor a 60')
  })

  it('accepts grades up to the course maximum', () => {
    expect(parseGrade('87,5', 100)).toEqual({ ok: true, value: 87.5 })
    expect(parseGrade('11', 10)).toEqual({ ok: false, error: 'Las notas van de 0 a 10' })
    expect(parseGrade('5,5')).toEqual({ ok: false, error: 'Las notas van de 0 a 5' })
  })
})

describe('column percentages', () => {
  it('weights graded columns and leaves pending ones out', () => {
    expect(weightedAverage([4, 2, null], [null, null, null])).toBe(3)
    expect(weightedAverage([4, 2, null], [20, 30, 50])).toBeCloseTo(2.8)
    expect(weightedAverage([null, null], [50, 50])).toBeNull()
  })

  it('reads percentages the way teachers write them', () => {
    expect(parseWeight('30 %')).toEqual({ ok: true, value: 30 })
    expect(parseWeight('33,33')).toEqual({ ok: true, value: 33.33 })
    expect(parseWeight('')).toEqual({ ok: true, value: null })
    expect(parseWeight('120').ok).toBe(false)
  })

  it('accepts no percentages or all of them adding up to 100', () => {
    expect(weightState([null, null])).toEqual({ kind: 'equal' })
    expect(weightState([30, 70])).toEqual({ kind: 'complete', sum: 100 })
    expect(weightState([30, null, null])).toEqual({ kind: 'incomplete', sum: 30, missing: 2 })
    expect(weightState([30, 60])).toEqual({ kind: 'off', sum: 90 })
  })

  it('splits 100 % evenly and fills what is missing', () => {
    expect(evenWeights(3)).toEqual([33.33, 33.33, 33.34])
    expect(fillMissingWeights([40, null, null])).toEqual([40, 30, 30])
    const filled = fillMissingWeights([10, null, null, null])
    expect(filled.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })
})

describe('adjusting percentages', () => {
  it('rescales to 100 keeping proportions', async () => {
    const { scaleWeightsTo100 } = await import('../gradeSheet')
    expect(scaleWeightsTo100([33.33, 33.33])).toEqual([50, 50])
    expect(scaleWeightsTo100([20, 20, 40])).toEqual([25, 25, 50])
  })
})

describe('cells', () => {
  it('writes cells without forced decimals over 100', async () => {
    const { formatCell } = await import('../gradeSheet')
    expect(formatCell(64, 100)).toBe('64')
    expect(formatCell(87.5, 100)).toBe('87,5')
    expect(formatCell(4, 5)).toBe('4,0')
  })
})

describe('academic area', () => {
  it('reads the subject from the course name', async () => {
    const { detectArea, stylesFor } = await import('../activityStyles')
    expect(detectArea('Álgebra Lineal — Grupo 2')).toBe('math')
    expect(detectArea('Filosofía Moderna')).toBe('humanities')
    expect(detectArea('Inglés B1')).toBe('languages')
    expect(detectArea('Patrones de Diseño — Grupo 61')).toBe('programming')
    expect(detectArea('Química orgánica')).toBe('science')
    expect(detectArea('Seminario de grado')).toBe('general')
    expect(stylesFor('humanities').map(s => s.id)).not.toContain('CODE')
    expect(stylesFor('programming').map(s => s.id)).toContain('DEPLOY')
  })
})
