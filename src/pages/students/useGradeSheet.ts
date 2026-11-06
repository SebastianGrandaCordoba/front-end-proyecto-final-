import { useCallback, useEffect, useMemo, useState } from 'react'
import { request } from '../../api'
import { cellKey, diff, parseWeight, plainNumber, weightState, type CellKey } from '../../lib/gradeSheet'

/** One corte as the backend sends it, already in the course scale (0–5, 0–10, 0–100…). */
export interface Sheet {
  period: string
  periods: string[]
  columns: { id: number; name: string; weight: number | null }[]
  suggested: boolean
  students: { id: number; name: string; email?: string | null }[]
  cells: { studentId: number; subjectId: number; grade: number }[]
  maxGrade: number
  passingGrade: number
  periodWeights: { period: string; weight: number | null }[]
}

/** A column while the teacher edits it: the percentage stays as typed until it is saved. */
export interface DraftColumn { id: number; name: string; weight: string }

const toDraft = (columns: Sheet['columns']): DraftColumn[] =>
  columns.map(c => ({ id: c.id, name: c.name, weight: c.weight == null ? '' : plainNumber(Number(c.weight)) }))

/**
 * State of the grade editor: the open corte, the cells typed but not saved and the columns
 * (order, names, percentages). Nothing reaches the backend until {@link save}.
 */
export function useGradeSheet(courseId: number, onError: (message: string) => void) {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [columns, setColumns] = useState<DraftColumn[]>([])
  const [columnsDirty, setColumnsDirty] = useState(false)
  const [drafts, setDrafts] = useState<Map<CellKey, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const apply = useCallback((data: Sheet) => {
    setSheet(data)
    setColumns(toDraft(data.columns))
    // Columns copied from the previous corte are a proposal: saving keeps them for this corte.
    setColumnsDirty(data.suggested)
    setDrafts(new Map())
  }, [])

  const load = useCallback(async (period: string | null) => {
    setLoading(true)
    try {
      const query = period ? `?period=${encodeURIComponent(period)}` : ''
      apply(await request<Sheet>(`/api/courses/${courseId}/grade-sheet${query}`))
    } catch (error) { onError(error instanceof Error ? error.message : 'No se pudo abrir la planilla.') }
    finally { setLoading(false) }
  }, [courseId, apply, onError])

  useEffect(() => { void load(null) }, [load])

  /** New students appear in the table without losing what the teacher already typed. */
  const reloadRoster = useCallback(async () => {
    if (!sheet) return
    const data = await request<Sheet>(`/api/courses/${courseId}/grade-sheet?period=${encodeURIComponent(sheet.period)}`)
    setSheet(current => current ? { ...current, students: data.students } : data)
  }, [courseId, sheet])

  const max = sheet?.maxGrade ?? 5
  const original = useMemo(() => new Map((sheet?.cells ?? []).map(c => [cellKey(c.studentId, c.subjectId), Number(c.grade)])), [sheet])
  const { changes, invalid } = useMemo(() => diff(original, drafts, max), [original, drafts, max])
  const weights = useMemo(() => columns.map(c => { const p = parseWeight(c.weight); return p.ok ? p.value : null }), [columns])
  const badWeights = useMemo(() => columns.filter(c => !parseWeight(c.weight).ok).map(c => c.id), [columns])
  const weighting = useMemo(() => weightState(weights), [weights])
  const serverColumns = useMemo(() => new Set(sheet && !sheet.suggested ? sheet.columns.map(c => c.id) : []), [sheet])
  const pending = changes.length + (columnsDirty ? 1 : 0)

  const editColumns = (update: (list: DraftColumn[]) => DraftColumn[]) => { setColumns(update); setColumnsDirty(true) }

  /** Reasons the corte cannot be saved yet, in the order the teacher should fix them. */
  const blocker = invalid.length ? `Revisa ${invalid.length === 1 ? 'la nota marcada en rojo' : `las ${invalid.length} notas marcadas en rojo`}.`
    : badWeights.length ? 'Hay un porcentaje que no es un número entre 0 y 100.'
    : weighting.kind === 'incomplete' ? `Falta el porcentaje de ${weighting.missing === 1 ? 'una columna' : `${weighting.missing} columnas`}.`
    : weighting.kind === 'off' ? `Los porcentajes suman ${plainNumber(weighting.sum)} %; deben sumar 100 %.`
    : null

  const save = async () => {
    if (!sheet || blocker || !pending) return null
    const body = {
      period: sheet.period,
      changes,
      columns: columnsDirty ? columns.map((c, i) => ({ subjectId: c.id, weight: weights[i] })) : undefined,
    }
    const result = await request<{ saved: number; cleared: number; sheet: Sheet }>(`/api/courses/${courseId}/grade-sheet`, { method: 'PUT', body: JSON.stringify(body) })
    apply(result.sheet)
    return result
  }

  const rename = async (subjectId: number, name: string) => {
    if (!sheet) return
    apply(await request<Sheet>(`/api/courses/${courseId}/grade-sheet/columns/${subjectId}?period=${encodeURIComponent(sheet.period)}`,
      { method: 'PUT', body: JSON.stringify({ name }) }))
  }

  const remove = async (subjectId: number) => {
    if (!sheet) return
    apply(await request<Sheet>(`/api/courses/${courseId}/grade-sheet/columns/${subjectId}?period=${encodeURIComponent(sheet.period)}`, { method: 'DELETE' }))
  }

  const changeScale = async (maxGrade: number) => {
    await request(`/api/courses/${courseId}/grading-scale`, { method: 'PUT', body: JSON.stringify({ maxGrade }) })
    await load(sheet?.period ?? null)
  }

  return {
    sheet, loading, load, reloadRoster, max,
    columns, editColumns, columnsDirty, serverColumns, weights, badWeights, weighting,
    drafts, setDrafts, original, changes, invalid, pending, blocker,
    save, rename, remove, changeScale,
    discard: () => { if (sheet) apply(sheet) },
  }
}
