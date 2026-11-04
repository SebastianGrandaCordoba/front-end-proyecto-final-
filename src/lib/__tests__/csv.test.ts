import { describe, expect, it } from 'vitest'
import type { Candidate } from '../domain'
import { learningReportCsv, rosterCsv, toCsv } from '../files'

const students = [
  { id: 1, name: 'Ana "Anita" Ruiz', email: 'ana@u.co', average: 2.4, gradeCount: 3, hasGrades: true, level: 'LOW' },
  { id: 2, name: 'Luis', email: null, average: NaN, gradeCount: 0, hasGrades: false, level: 'MEDIUM' },
] as Candidate[]

describe('CSV', () => {
  it('quotes values, doubles inner quotes and adds a BOM', () => {
    expect(toCsv([['a', 'b"c']])).toBe('\uFEFF"a";"b""c"')
  })

  it('exports the roster with averages and status', () => {
    const lines = rosterCsv(students).slice(1).split('\r\n')
    expect(lines[0]).toBe('"Nombre";"Correo";"Promedio";"Notas";"Estado"')
    expect(lines[1]).toBe('"Ana ""Anita"" Ruiz";"ana@u.co";"2,4";"3";"Necesita refuerzo"')
    expect(lines[2]).toBe('"Luis";"";"";"0";"Sin notas"')
  })

  it('explains each status in the learning report', () => {
    const csv = learningReportCsv(students)
    expect(csv).toContain('Promedio menor a 3,0 en 3 nota(s)')
    expect(csv).toContain('No tiene notas cargadas')
  })
})
