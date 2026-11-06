/** Pure logic of the grade editor: parsing what the teacher types, pasting from Excel and finding changes. */

export type CellKey = `${number}:${number}` // studentId:subjectId
export const cellKey = (studentId: number, subjectId: number): CellKey => `${studentId}:${subjectId}`

export type Parsed = { ok: true; value: number | null } | { ok: false; error: string }

/** Writes a scale or a percentage the Colombian way: 100, 87,5, 33,33. */
export const plainNumber = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',')

/**
 * "3,5", "3.5", " 4 " → number; empty → null (clears the grade). Same rules as the backend:
 * from 0 to the course maximum (5, 10, 100…), two decimals at most.
 */
export function parseGrade(text: string, max = 5): Parsed {
  const raw = text.trim().replace(',', '.')
  if (raw === '') return { ok: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: `Escribe un número, por ejemplo ${max === 5 ? '3,5' : plainNumber(max * 0.7)}` }
  const value = Number(raw)
  if (value < 0 || value > max) return { ok: false, error: `Las notas van de 0 a ${plainNumber(max)}` }
  if ((raw.split('.')[1] ?? '').replace(/0+$/, '').length > 2) return { ok: false, error: 'Máximo dos decimales' }
  return { ok: true, value: Math.round(value * 100) / 100 }
}

/** How a stored grade appears in the cell: Colombian decimal comma, no trailing zeros beyond one decimal. */
export function formatCell(value: number | null | undefined, max = 5) {
  if (value == null) return ''
  // On 0–100 a grade is "64" or "87,5"; on 0–5 or 0–10 teachers expect "4,0".
  if (max > 20) return String(Math.round(value * 100) / 100).replace('.', ',')
  const fixed = Number.isInteger(value * 10) ? value.toFixed(1) : value.toFixed(2)
  return fixed.replace('.', ',')
}

export interface Change { studentId: number; subjectId: number; grade: number | null }

/** Cells whose parsed value differs from the server; invalid cells are reported, not sent. */
export function diff(original: Map<CellKey, number>, drafts: Map<CellKey, string>, max = 5) {
  const changes: Change[] = []
  const invalid: CellKey[] = []
  for (const [key, text] of drafts) {
    const parsed = parseGrade(text, max)
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

/**
 * Grade of a student in one corte. Without percentages every graded column counts the same; with them, the
 * graded columns are weighted and the pending ones are left out (same rule as the backend analysis).
 */
export function weightedAverage(values: (number | null)[], weights: (number | null)[]) {
  if (weights.every(w => w == null)) return rowAverage(values)
  let sum = 0
  let total = 0
  values.forEach((value, i) => {
    const weight = weights[i] ?? 0
    if (value != null && weight > 0) { sum += value * weight; total += weight }
  })
  return total > 0 ? sum / total : null
}

export type ParsedWeight = { ok: true; value: number | null } | { ok: false; error: string }

/** "30", "33,33", "30 %" → number; empty → no percentage. */
export function parseWeight(text: string): ParsedWeight {
  const raw = text.trim().replace('%', '').trim().replace(',', '.')
  if (raw === '') return { ok: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: 'Escribe un porcentaje, por ejemplo 30' }
  const value = Number(raw)
  if (value > 100) return { ok: false, error: 'Un porcentaje va de 0 a 100' }
  if ((raw.split('.')[1] ?? '').length > 2) return { ok: false, error: 'Máximo dos decimales' }
  return { ok: true, value }
}

export type WeightState =
  | { kind: 'equal' }
  | { kind: 'complete'; sum: number }
  | { kind: 'incomplete'; sum: number; missing: number }
  | { kind: 'off'; sum: number }

/** Whether the percentages of a corte can be saved: none (equal weights) or all of them adding up to 100. */
export function weightState(weights: (number | null)[]): WeightState {
  const given = weights.filter((w): w is number => w != null)
  if (!given.length) return { kind: 'equal' }
  const sum = Math.round(given.reduce((a, b) => a + b, 0) * 100) / 100
  if (given.length < weights.length) return { kind: 'incomplete', sum, missing: weights.length - given.length }
  return Math.abs(sum - 100) <= 0.01 ? { kind: 'complete', sum } : { kind: 'off', sum }
}

/** 100 % split in {@code n} parts with two decimals; the last one takes the rounding (33,33 + 33,33 + 33,34). */
export function evenWeights(n: number) {
  if (n <= 0) return []
  const base = Math.floor(10000 / n) / 100
  const weights = Array.from({ length: n }, () => base)
  weights[n - 1] = Math.round((100 - base * (n - 1)) * 100) / 100
  return weights
}

/** Fills the columns without percentage with what is left to reach 100 %, in equal parts. */
export function fillMissingWeights(weights: (number | null)[]) {
  const missing = weights.filter(w => w == null).length
  if (!missing) return weights as number[]
  const left = Math.max(0, 100 - weights.reduce<number>((a, w) => a + (w ?? 0), 0))
  const parts = evenWeights(missing).map(part => Math.round(part * left) / 100)
  const fix = Math.round((left - parts.reduce((a, b) => a + b, 0)) * 100) / 100
  if (parts.length) parts[parts.length - 1] = Math.round((parts[parts.length - 1] + fix) * 100) / 100
  let next = 0
  return weights.map(w => w ?? parts[next++])
}

/** Typical scales in Colombian and Latin American universities and schools. */
export const COMMON_SCALES = [5, 10, 20, 100] as const

/** The passing grade keeps its proportion in every scale: 3,0/5 = 6/10 = 60/100. */
export const passingFor = (max: number, passingOnFive = 3) => Math.round(passingOnFive / 5 * max * 100) / 100

/** Keeps the proportions but makes them add up to 100 % (useful after deleting a weighted column). */
export function scaleWeightsTo100(weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return evenWeights(weights.length)
  const scaled = weights.map(w => Math.round(w / sum * 10000) / 100)
  const fix = Math.round((100 - scaled.reduce((a, b) => a + b, 0)) * 100) / 100
  if (scaled.length) scaled[scaled.length - 1] = Math.round((scaled[scaled.length - 1] + fix) * 100) / 100
  return scaled
}
