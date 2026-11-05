import { describe, expect, it } from 'vitest'
import { splitFences } from '../../components/RichText'

describe('splitFences', () => {
  it('keeps prose and code apart', () => {
    const parts = splitFences('Propósito: practicar.\n```java\nclass A {\n  void run() {}\n}\n```\nEvidencia: repositorio.')
    expect(parts.map(p => p.kind)).toEqual(['text', 'code', 'text'])
    expect(parts[1]).toEqual({ kind: 'code', lang: 'java', value: 'class A {\n  void run() {}\n}' })
  })
  it('returns plain text untouched', () => {
    expect(splitFences('Solo texto')).toEqual([{ kind: 'text', value: 'Solo texto' }])
  })
})
