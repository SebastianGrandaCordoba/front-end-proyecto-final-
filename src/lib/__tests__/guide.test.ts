import { describe, expect, it } from 'vitest'
import { GUIDE, currentStep, initialGuide, markDone } from '../guide'

describe('Primeros pasos', () => {
  it('walks the steps in order and skips what is done or skipped', () => {
    expect(currentStep(initialGuide)?.id).toBe('profile')
    const state = markDone({ ...initialGuide, skipped: ['profile'] }, ['course'])
    expect(currentStep(state)?.id).toBe('students')
    expect(currentStep({ ...initialGuide, done: GUIDE.map(s => s.id) })).toBeNull()
  })

  it('marking a step twice changes nothing and un-skips it', () => {
    const once = markDone({ ...initialGuide, skipped: ['workshop'] }, ['workshop'])
    expect(once.done).toEqual(['workshop'])
    expect(once.skipped).toEqual([])
    expect(markDone(once, ['workshop'])).toBe(once)
  })

  it('every step says where to go and what to point at', () => {
    for (const step of GUIDE) {
      expect(step.targets.length).toBeGreaterThan(0)
      expect(step.hint.length).toBeGreaterThan(20)
    }
    expect(new Set(GUIDE.map(s => s.id)).size).toBe(GUIDE.length)
  })
})
