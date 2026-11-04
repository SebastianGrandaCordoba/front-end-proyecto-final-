import { describe, expect, it } from 'vitest'
import { gradeTone } from '../domain'

describe('grade tone', () => {
  it('matches the level the teacher sees', () => {
    expect(gradeTone(2.94)).toBe('low')
    expect(gradeTone(2.95)).toBe('medium')
    expect(gradeTone(4.0)).toBe('high')
  })
})
