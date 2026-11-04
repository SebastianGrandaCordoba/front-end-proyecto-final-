import { describe, expect, it } from 'vitest'
import { adaptReply, type ApiReply } from '../buho'
import type { Candidate } from '../domain'

const ana = { id: 1, name: 'Ana Ruiz' } as Candidate

describe('Búho reply adapter', () => {
  it('turns backend actions into interface actions', () => {
    const api: ApiReply = {
      text: 'Hola', intent: 'x', items: [{ studentId: 1, name: 'Ana Ruiz', value: '2,0', note: 'baja', tone: 'low' }],
      actions: [
        { kind: 'navigate', label: 'Simulador', params: { route: 'seguimiento', vista: 'simulador' } },
        { kind: 'workshop', label: 'Taller', params: { mode: 'quiz', level: 'LOW', topic: 'Cinemática', studentId: '1' } },
        { kind: 'message', label: 'Escribir', params: { studentId: '99' } },
      ],
      run: { kind: 'report', label: 'Informe', params: {} },
    }
    const reply = adaptReply(api, [ana])
    expect(reply.items?.[0].student).toBe(ana)
    expect(reply.actions?.[0]).toEqual({ kind: 'navigate', label: 'Simulador', route: 'seguimiento', params: { vista: 'simulador' } })
    expect(reply.actions?.[1]).toMatchObject({ kind: 'workshop', mode: 'quiz', student: ana, topic: 'Cinemática' })
    expect(reply.actions).toHaveLength(2) // unknown student is dropped
    expect(reply.run?.kind).toBe('report')
  })

  it('ignores unknown action kinds', () => {
    const reply = adaptReply({ text: 't', intent: 'x', items: [], actions: [{ kind: 'dance', label: '?', params: {} }], run: null }, [])
    expect(reply.actions).toEqual([])
    expect(reply.run).toBeUndefined()
  })
})
