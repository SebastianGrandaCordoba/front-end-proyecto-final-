import { describe, expect, it } from 'vitest'
import { gridToGradeRows, normalizeSpreadsheetRows } from '../../spreadsheet'

describe('gridToGradeRows', () => {
  it('turns students × topics into one grade per row with the sheet as corte', () => {
    const rows = gridToGradeRows([
      ['Estudiante', 'Correo', 'Parcial 1', 'Taller'],
      ['Laura Méndez', 'laura@u.edu', '3,8', '4.2'],
      ['Camilo Rojas', '', '2,6', ''],
      ['', '', '', ''],
    ], 'Corte 2')
    expect(rows).toEqual([
      ['studentName', 'studentEmail', 'subject', 'grade', 'period'],
      ['Laura Méndez', 'laura@u.edu', 'Parcial 1', '3,8', 'Corte 2'],
      ['Laura Méndez', 'laura@u.edu', 'Taller', '4.2', 'Corte 2'],
      ['Camilo Rojas', '', 'Parcial 1', '2,6', 'Corte 2'],
    ])
  })

  it('leaves the classic one-grade-per-row layout alone', () => {
    expect(gridToGradeRows([['Estudiante', 'Materia', 'Nota', 'Periodo']], 'Hoja1')).toBeNull()
  })

  it('needs a student column', () => {
    expect(gridToGradeRows([['Tema 1', 'Tema 2']], 'Corte 1')).toBeNull()
  })

  it('produces rows the backend importer accepts', async () => {
    const rows = gridToGradeRows([['Estudiante', 'Parcial'], ['Ana', '3,5']], 'Corte 1')!
    const csv = await normalizeSpreadsheetRows(rows, 'grades')
    expect(csv).toContain('Ana,,Parcial,3.50,Corte 1')
  })

  it('names the student when a grade is out of range', async () => {
    const rows = gridToGradeRows([['Estudiante', 'Parcial'], ['Ana', '7']], 'Corte 1')!
    await expect(normalizeSpreadsheetRows(rows, 'grades')).rejects.toThrow('de Ana no está entre 0 y 5')
  })
})

describe('countEntries', () => {
  it('counts non-empty lines that are not bare emails', async () => {
    const { countEntries } = await import('../../pages/students/QuickAdd')
    expect(countEntries('Ana\n\n Luis; luis@u.edu \nsolo@u.edu\n')).toBe(2)
  })
})
