import { describe, expect, it } from 'vitest'
import { parseHash } from '../router'

describe('hash router', () => {
  it('reads the route and its parameters', () => {
    const location = parseHash('#/seguimiento?vista=simulador')
    expect(location.route).toBe('seguimiento')
    expect(location.params.get('vista')).toBe('simulador')
  })

  it('sends unknown or empty hashes home', () => {
    expect(parseHash('').route).toBe('inicio')
    expect(parseHash('#/nada').route).toBe('inicio')
    expect(parseHash('#estudiantes').route).toBe('estudiantes')
  })
})
