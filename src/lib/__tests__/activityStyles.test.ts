import { describe, expect, it } from 'vitest'
import { goalFor, isExtended, toggleStyle } from '../activityStyles'

describe('toggleStyle', () => {
  it('replaces the default guided choice', () => {
    expect(toggleStyle(['GUIDED'], 'CODE')).toEqual(['CODE'])
  })
  it('keeps at most three styles', () => {
    expect(toggleStyle(['CODE', 'APP', 'DEPLOY'], 'TEAM')).toEqual(['CODE', 'APP', 'DEPLOY'])
  })
  it('falls back to guided when the last style is removed', () => {
    expect(toggleStyle(['CODE'], 'CODE')).toEqual(['GUIDED'])
  })
  it('choosing guided clears the others', () => {
    expect(toggleStyle(['CODE', 'CASE'], 'GUIDED')).toEqual(['GUIDED'])
  })
})

describe('styles', () => {
  it('marks code, apps, deployments and team projects as extended work', () => {
    expect(isExtended(['CASE'])).toBe(false)
    expect(isExtended(['CASE', 'DEPLOY'])).toBe(true)
  })
  it('writes a goal for the most demanding style', () => {
    expect(goalFor(['CODE', 'DEPLOY'], 'Observer')).toContain('publicándolo')
    expect(goalFor(['GUIDED'], 'Observer')).toBeNull()
  })
})
