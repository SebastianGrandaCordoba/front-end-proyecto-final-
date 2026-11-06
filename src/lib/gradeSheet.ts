/** Pure logic of the grade editor: parsing what the teacher types, pasting from Excel and finding changes. */

export type CellKey = `${number}:${number}` // studentId:subjectId
export const cellKey = (studentId: number, subjectId: number): CellKey => `${studentId}:${subjectId}`

export type Parsed = { ok: true; value: number | null } | { ok: false; error: string }

/** "3,5", "3.5", " 4 " → number; empty → null (clears the grade). Same rules as the backend: 0–5, two decimals. */
export function parseGrade(text: string): Parsed {
  const raw = text.trim().replace(',', '.')
  if (raw === '') return { ok: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: 'Escribe un número, por ejemplo 3,5' }
  const value = Number(raw)
  if (value < 0 || value > 5) return { ok: false, error: 'Las notas van de 0 a 5' }
  if ((raw.split('.')[1] ?? '').replace(/0+$/, '').length > 2) return { ok: false, error: 'Máximo dos decimales' }
  return { ok: true, value: Math.round(value * 100) / 100 }
}

/** How a stored grade appears in the cell: Colombian decimal comma, no trailing zeros beyond one decimal. */
export function formatCell(value: number | null | undefined) {
  if (value == null) return ''
  const fixed = Number.isInteger(value * 10) ? value.toFixed(1) : value.toFixed(2)
  return fixed.replace('.', ',')
}

export interface Change { studentId: number; subjectId: number; grade: number | null }

/** Cells whose parsed value differs from the server; invalid cells are reported, not sent. */
export function diff(original: Map<CellKey, number>, drafts: Map<CellKey, string>) {
  const changes: Change[] = []
  const invalid: CellKey[] = []
  for (const [key, text] of drafts) {
    const parsed = parseGrade(text)
    if (!parsed.ok) { invalid.push(key); continue }
    const before = original.get(key) ?? null
    if (parsed.value !== before) {
      const [studentId, subjectId] = key.split(':').map(Number)
      changes.push({ studentId, subjectId, grade: parsed.value })
    }
  }
  return { changes, invalid }
}

/**
 * Text copied from Excel or Google Sheets (rows by newline, columns by tab) pasted at a cell:
 * returns the drafts it fills, clipped to the table.
 */
export function pasteBlock(text: string, start: { row: number; col: number }, rows: number[], cols: number[]) {
  const filled = new Map<CellKey, string>()
  const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n')
  lines.forEach((line, r) => {
    line.split('\t').forEach((value, c) => {
      const studentId = rows[start.row + r]
      const subjectId = cols[start.col + c]
      if (studentId != null && subjectId != null) filled.set(cellKey(studentId, subjectId), value.trim())
    })
  })
  return filled
}

/** Name for a new corte: one more than the highest "Corte N", or "Corte 1". */
export function nextPeriodName(periods: string[]) {
  const numbers = periods.map(p => Number(/(\d+)\D*$/.exec(p)?.[1])).filter(Number.isFinite)
  return `Corte ${numbers.length ? Math.max(...numbers) + 1 : 1}`
}

/** Average of the numeric drafts of one student in the open corte, for the live column. */
export function rowAverage(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v != null)
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}
