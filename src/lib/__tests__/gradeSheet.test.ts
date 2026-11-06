import { describe, expect, it } from 'vitest'
import { cellKey, diff, formatCell, nextPeriodName, parseGrade, pasteBlock, rowAverage } from '../gradeSheet'

describe('parseGrade', () => {
  it('accepts comma or dot and empty to clear', () => {
    expect(parseGrade('3,5')).toEqual({ ok: true, value: 3.5 })
    expect(parseGrade(' 4.25 ')).toEqual({ ok: true, value: 4.25 })
    expect(parseGrade('')).toEqual({ ok: true, value: null })
    expect(parseGrade('5,00')).toEqual({ ok: true, value: 5 })
  })
  it('rejects text, out of range and too many decimals', () => {
    expect(parseGrade('tres').ok).toBe(false)
    expect(parseGrade('5,1')).toEqual({ ok: false, error: 'Las notas van de 0 a 5' })
    expect(parseGrade('3,333')).toEqual({ ok: false, error: 'Máximo dos decimales' })
    expect(parseGrade('-1').ok).toBe(false)
  })
})

describe('formatCell', () => {
  it('uses a decimal comma', () => {
    expect(formatCell(3.5)).toBe('3,5')
    expect(formatCell(4)).toBe('4,0')
    expect(formatCell(4.25)).toBe('4,25')
    expect(formatCell(null)).toBe('')
  })
})

describe('diff', () => {
  const original = new Map([[cellKey(1, 10), 3.5], [cellKey(2, 10), 4]])
  it('sends only real changes and clears', () => {
    const drafts = new Map([[cellKey(1, 10), '3,50'], [cellKey(2, 10), ''], [cellKey(3, 10), '2,8']])
    expect(diff(original, drafts).changes).toEqual([
      { studentId: 2, subjectId: 10, grade: null },
      { studentId: 3, subjectId: 10, grade: 2.8 },
    ])
  })
  it('keeps invalid cells out', () => {
    const result = diff(original, new Map([[cellKey(1, 10), '9']]))
    expect(result.changes).toEqual([])
    expect(result.invalid).toEqual([cellKey(1, 10)])
  })
})

describe('pasteBlock', () => {
  it('fills a block from Excel and clips to the table', () => {
    const filled = pasteBlock('3,5\t4\n2,8\t5\n4\t4\n', { row: 1, col: 0 }, [1, 2, 3], [10, 20])
    expect([...filled]).toEqual([[cellKey(2, 10), '3,5'], [cellKey(2, 20), '4'], [cellKey(3, 10), '2,8'], [cellKey(3, 20), '5']])
  })
})

describe('helpers', () => {
  it('names the next corte', () => {
    expect(nextPeriodName(['Corte 1', 'Corte 2'])).toBe('Corte 3')
    expect(nextPeriodName([])).toBe('Corte 1')
  })
  it('averages only filled cells', () => {
    expect(rowAverage([3, null, 4])).toBe(3.5)
    expect(rowAverage([null])).toBeNull()
  })
})
