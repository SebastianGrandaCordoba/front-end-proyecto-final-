import { describe, expect, it } from 'vitest'
import type { GeneratedWorkshop } from '../../api'
import { slugify, workshopAsText } from '../files'
import { mailtoLink } from '../report'

const workshop: GeneratedWorkshop = {
  title: 'Taller: ciclos', subject: 'Programación', targetLevel: 'LOW', summary: 'Repaso.',
  learningObjectives: ['Usar for'], activities: [{ title: 'Trazar', instructions: 'Sigue el ciclo.', estimatedMinutes: 15 }],
  assessment: [{ question: '¿Cuántas veces?', options: ['3', '4'], correctAnswer: '3', explanation: 'range(3).' }], sourceReferences: ['Unidad 3.pdf'],
}

describe('files', () => {
  it('slugifies titles for file names', () => {
    expect(slugify('Taller: ciclos for & while — Corte 2')).toBe('taller-ciclos-for-while-corte-2')
    expect(slugify('Fotosíntesis')).toBe('fotosintesis')
  })

  it('copies a workshop as readable text with the answer key', () => {
    const text = workshopAsText(workshop)
    expect(text).toContain('OBJETIVOS')
    expect(text).toContain('1. Trazar (15 min)')
    expect(text).toContain('Respuesta: 3. range(3).')
    expect(text).toContain('Material consultado: Unidad 3.pdf')
  })

  it('builds mailto links with encoded subject and body', () => {
    expect(mailtoLink('ana@u.co', 'Hola Ana', 'Línea 1\nLínea 2')).toBe('mailto:ana%40u.co?subject=Hola%20Ana&body=L%C3%ADnea%201%0AL%C3%ADnea%202')
  })
})
