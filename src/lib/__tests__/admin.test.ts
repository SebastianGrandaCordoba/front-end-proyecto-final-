import { describe, expect, it } from 'vitest'
import { actionLabel, filterAccounts, lastSeen, type AdminAccount } from '../admin'

const account = (over: Partial<AdminAccount>): AdminAccount => ({
  id: 1, name: 'Ana Pérez', email: 'ana@uni.edu', role: 'TEACHER', active: true, createdAt: null, lastLoginAt: null,
  courses: 1, students: 10, grades: 20, materials: 0, ...over,
})
const list = [
  account({ id: 1 }),
  account({ id: 2, name: 'Luis Gómez', email: 'luis@uni.edu', active: false }),
  account({ id: 3, name: 'Root', email: 'root@fairteam.test', role: 'ADMIN', courses: 0 }),
  account({ id: 4, name: 'Nueva', email: 'nueva@uni.edu', courses: 0 }),
]

describe('filterAccounts', () => {
  it('groups by role, status and empty workspaces', () => {
    expect(filterAccounts(list, 'teachers', '').map(a => a.id)).toEqual([1, 2, 4])
    expect(filterAccounts(list, 'admins', '').map(a => a.id)).toEqual([3])
    expect(filterAccounts(list, 'inactive', '').map(a => a.id)).toEqual([2])
    expect(filterAccounts(list, 'empty', '').map(a => a.id)).toEqual([4])
  })
  it('searches name and email ignoring accents and case', () => {
    expect(filterAccounts(list, 'all', 'PEREZ').map(a => a.id)).toEqual([1])
    expect(filterAccounts(list, 'all', 'gomez').map(a => a.id)).toEqual([2])
    expect(filterAccounts(list, 'all', '@fairteam').map(a => a.id)).toEqual([3])
  })
})

describe('lastSeen', () => {
  const now = new Date('2026-11-15T12:00:00Z')
  it('describes how long ago in Spanish', () => {
    expect(lastSeen(null, now)).toBe('Nunca')
    expect(lastSeen('2026-11-15T01:00:00Z', now)).toBe('Hoy')
    expect(lastSeen('2026-11-14T08:00:00Z', now)).toBe('Ayer')
    expect(lastSeen('2026-11-10T12:00:00Z', now)).toBe('Hace 5 días')
    expect(lastSeen('2026-08-01T12:00:00Z', now)).toBe('Hace 3 meses')
  })
})

describe('actionLabel', () => {
  it('translates known audit actions and keeps unknown ones', () => {
    expect(actionLabel('PASSWORD_RESET')).toBe('Restableció la contraseña')
    expect(actionLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE')
  })
})
