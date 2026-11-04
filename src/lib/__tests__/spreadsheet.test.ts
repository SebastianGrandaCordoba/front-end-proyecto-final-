import { describe, expect, it } from 'vitest'
import { normalizeSpreadsheetRows } from '../../spreadsheet'

describe('spreadsheet import', () => {
  it('recognizes Spanish headers for grades', async () => {
    const csv = await normalizeSpreadsheetRows([['Nombre', 'Materia', 'Nota', 'Periodo'], ['Ana Ruiz', 'Física', 4.5, 'Corte 1']], 'grades')
    expect(csv.split(/\r?\n/)[0]).toContain('studentName')
    expect(csv).toContain('Ana Ruiz')
  })

  it('recognizes roster headers with accents', async () => {
    const csv = await normalizeSpreadsheetRows([['Nombre completo', 'Correo electrónico'], ['Luis Paz', 'luis@u.co']], 'roster')
    expect(csv.split(/\r?\n/)[0]).toContain('name')
    expect(csv).toContain('luis@u.co')
  })
})
