import { describe, expect, it } from 'vitest'
import { changed, isoDate, tally, type AttendanceStatus } from '../attendance'

describe('attendance helpers', () => {
  it('formats local dates without shifting to UTC', () => {
    expect(isoDate(new Date(2026, 10, 5, 21, 30))).toBe('2026-11-05')
  })
  it('counts marks by status', () => {
    const marks = new Map<number, AttendanceStatus>([[1, 'PRESENT'], [2, 'ABSENT'], [3, 'PRESENT']])
    expect(tally(marks)).toEqual({ PRESENT: 2, ABSENT: 1, LATE: 0, EXCUSED: 0 })
  })
  it('detects unsaved changes', () => {
    const saved = new Map<number, AttendanceStatus>([[1, 'PRESENT']])
    expect(changed(saved, new Map(saved))).toBe(false)
    expect(changed(saved, new Map([[1, 'LATE']]))).toBe(true)
    expect(changed(saved, new Map([[1, 'PRESENT'], [2, 'ABSENT']]))).toBe(true)
  })
})

describe('sessionLabel', () => {
  it('capitalizes only the first letter', async () => {
    const { sessionLabel } = await import('../attendance')
    const label = sessionLabel('2026-10-29')
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase())
    expect(label).not.toMatch(/ De /)
  })
})
