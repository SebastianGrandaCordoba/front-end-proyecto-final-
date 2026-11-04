import { describe, expect, it } from 'vitest'
import { adaptReply, examples, followUpsByIntent } from '../buho'

describe('Búho follow-ups', () => {
  it('suggests next questions for known intents only', () => {
    const base = { text: 't', items: [], actions: [], run: null }
    expect(adaptReply({ ...base, intent: 'falling-behind' }, []).followUps).toEqual(followUpsByIntent['falling-behind'])
    expect(adaptReply({ ...base, intent: 'fallback' }, []).followUps).toEqual([])
  })

  it('keeps example questions short enough to read at a glance', () => {
    for (const example of examples) expect(example.length).toBeLessThan(45)
  })
})
