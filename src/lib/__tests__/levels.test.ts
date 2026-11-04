import { describe, expect, it } from 'vitest'
import { levelFromAverage, levelOf, round1 } from '../domain'

describe('levels', () => {
  it('classifies on the value the teacher sees', () => {
    expect(levelFromAverage(2.94)).toBe('LOW')
    expect(levelFromAverage(2.96)).toBe('MEDIUM')
    expect(levelFromAverage(3.96)).toBe('HIGH')
    expect(round1(2.96)).toBe(3)
  })

  it('reads profile levels in Spanish or English', () => {
    expect(levelOf('bajo')).toBe('LOW')
    expect(levelOf('ALTA')).toBe('HIGH')
    expect(levelOf(undefined)).toBe('MEDIUM')
  })
})
