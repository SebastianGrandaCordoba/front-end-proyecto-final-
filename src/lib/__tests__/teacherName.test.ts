import { describe, expect, it } from 'vitest'
import { teacherFirstName } from '../domain'

describe('teacherFirstName', () => {
  it('skips titles such as Prof. or Dra.', () => {
    expect(teacherFirstName('Prof. Carolina Méndez')).toBe('Carolina')
    expect(teacherFirstName('Dra. Ana Ruiz')).toBe('Ana')
    expect(teacherFirstName('ing jorge pérez')).toBe('jorge')
  })

  it('keeps plain names and falls back to profe', () => {
    expect(teacherFirstName('Sebastián Granda')).toBe('Sebastián')
    expect(teacherFirstName('Prof.')).toBe('profe')
    expect(teacherFirstName('')).toBe('profe')
  })
})
