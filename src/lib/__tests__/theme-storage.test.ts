import { afterEach, describe, expect, it } from 'vitest'
import { storedTheme } from '../theme'

const memory = new Map<string, string>()
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v), removeItem: k => void memory.delete(k), clear: () => memory.clear(), key: () => null, length: 0 } as Storage

describe('stored theme', () => {
  afterEach(() => memory.clear())

  it('defaults to following the system', () => {
    expect(storedTheme()).toBe('system')
  })

  it('reads a saved choice and ignores garbage', () => {
    memory.set('fairteam.theme', 'dark')
    expect(storedTheme()).toBe('dark')
    memory.set('fairteam.theme', 'purple')
    expect(storedTheme()).toBe('system')
  })
})
