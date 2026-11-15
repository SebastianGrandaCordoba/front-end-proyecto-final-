import { describe, expect, it } from 'vitest'
import { parseHash } from '../router'

describe('hash router', () => {
  it('reads the route and its parameters', () => {
    const location = parseHash('#/follow-up?view=simulator')
    expect(location.route).toBe('follow-up')
    expect(location.params.get('view')).toBe('simulator')
  })

  it('sends unknown or empty hashes home', () => {
    expect(parseHash('').route).toBe('home')
    expect(parseHash('#/nada').route).toBe('home')
    expect(parseHash('#students').route).toBe('students')
  })

  it('keeps addresses saved with Spanish names working', () => {
    const location = parseHash('#/seguimiento?vista=simulador')
    expect(location.route).toBe('follow-up')
    expect(location.params.get('view')).toBe('simulator')
    expect(parseHash('#/estudiantes?filtro=sin-notas').params.get('filter')).toBe('ungraded')
  })
})
