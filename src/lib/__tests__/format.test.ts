import { describe, expect, it } from 'vitest'
import { fileSize, firstName, formatGrade, initials, plural } from '../domain'

describe('formatting helpers', () => {
  it('formats grades with a comma and one decimal', () => {
    expect(formatGrade(3.45)).toBe('3,5')
    expect(formatGrade(3)).toBe('3,0')
  })

  it('writes natural plurals', () => {
    expect(plural(1, 'nota', 'notas')).toBe('1 nota')
    expect(plural(12, 'nota', 'notas')).toBe('12 notas')
  })

  it('takes initials and first names safely', () => {
    expect(initials('Ana María Torres')).toBe('AM')
    expect(initials('   ')).toBe('?')
    expect(firstName('  Luis  Pérez')).toBe('Luis')
    expect(firstName(null)).toBe('profe')
  })

  it('shows file sizes in KB or MB', () => {
    expect(fileSize(400)).toBe('1 KB')
    expect(fileSize(412_000)).toBe('402 KB')
    expect(fileSize(1_843_200)).toBe('1,8 MB')
  })
})
