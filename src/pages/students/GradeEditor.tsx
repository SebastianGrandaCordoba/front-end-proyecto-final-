import { useCallback, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Download, Percent, Plus, Save, Sigma, Table2, Undo2, UserPlus } from 'lucide-react'
import { request } from '../../api'
import { EmptyState, Spinner, useFeedback } from '../../components/ui'
import { formatScaled } from '../../lib/domain'
import type { Projection, Sim, Trend } from '../../lib/insights'
import { cellKey, evenWeights, fillMissingWeights, scaleWeightsTo100, formatCell, nextPeriodName, parseGrade, pasteBlock, plainNumber, rowAverage, weightedAverage, type CellKey } from '../../lib/gradeSheet'
import { ColumnHeader } from './ColumnHeader'
import { FinalGrades } from './FinalGrades'
import { ScalePicker } from './ScalePicker'
import { useGradeSheet } from './useGradeSheet'

const FINAL = '__final__'

interface Props {
  courseId: number
  courseName: string
  onSaved: () => void
  onScaleChanged: () => void
  onQuickAdd: () => void
  trends: Trend[]
  projections: Map<number, Projection>
  sim: Sim
  saveScheme: (weights: number[]) => Promise<void>
}

/**
 * Spreadsheet-like grade book. One tab per corte with its activity columns (each with an optional
 * percentage) and a "Definitiva" tab that weighs the cortes. Typing never saves on its own: changes are
 * collected, checked as you type and saved together, so a slip of the keyboard is easy to undo.
 */
export function GradeEditor({ courseId, courseName, onSaved, onScaleChanged, onQuickAdd, trends, projections, sim, saveScheme }: Props) {
  const { notify, confirm } = useFeedback()
  const onError = useCallback((message: string) => notify(message, 'error'), [notify])
  const book = useGradeSheet(courseId, onError)
  const { sheet, max, columns, weights, drafts, original, setDrafts } = book
  const [tab, setTab] = useState<string | null>(null)
  const [extraPeriods, setExtraPeriods] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [newStudent, setNewStudent] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const table = useRef<HTMLTableElement>(null)

  const period = sheet?.period ?? null
  const showingFinal = tab === FINAL
  const students = sheet?.students ?? []
  const periods = [...(sheet?.periods ?? [])]
  for (const p of [...extraPeriods, period ?? '']) if (p && !periods.includes(p)) periods.push(p)
  const invalidSet = new Set(book.invalid)
  const passing = sheet?.passingGrade ?? max * 0.6

  const textOf = (key: CellKey) => drafts.has(key) ? drafts.get(key)! : formatCell(original.get(key), max)
  const valueOf = (key: CellKey) => { const parsed = parseGrade(textOf(key), max); return parsed.ok ? parsed.value : null }

  const guard = async (action = 'Si cambias de corte') => !book.pending || confirm({ title: 'Tienes cambios sin guardar', body: `${action} se perderán los cambios de ${period}.`, confirm: 'Descartar cambios', danger: true })

  const openPeriod = async (next: string) => {
    if (next === FINAL) { if (await guard('Si abres la definitiva')) { if (book.pending) book.discard(); setTab(FINAL) } return }
    setTab(next)
    if (next !== period && await guard()) void book.load(next)
  }
  const newPeriod = async () => {
    if (!await guard()) return
    const name = nextPeriodName(periods)
    setExtraPeriods(list => [...list, name]); setTab(name)
    void book.load(name)
  }

  const addColumn = async () => {
    const name = columnName.trim().replace(/\s+/g, ' ')
    if (!name) return
    const existing = columns.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (existing) { notify(`"${existing.name}" ya es una columna de este corte.`, 'info'); return }
    try {
      // Activities are shared by all of the teacher's courses: reuse one with the same name instead of duplicating it.
      const known = await request<{ id: number; name: string }[]>('/api/subjects')
      const created = known.find(s => s.name.trim().toLowerCase() === name.toLowerCase())
        ?? await request<{ id: number; name: string }>('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) })
      book.editColumns(list => [...list, { id: created.id, name: created.name, weight: '' }])
      setColumnName(''); setAddingColumn(false)
      window.setTimeout(() => focusCell(0, columns.length), 50)
    } catch (error) { onError(error instanceof Error ? error.message : 'No se pudo agregar la columna.') }
  }

  const renameColumn = async (index: number, name: string) => {
    const column = columns[index]
    if (!book.serverColumns.has(column.id)) {
      // Not saved yet: just point the column at the activity with the new name.
      const known = await request<{ id: number; name: string }[]>('/api/subjects')
      const target = known.find(s => s.name.trim().toLowerCase() === name.toLowerCase())
        ?? await request<{ id: number; name: string }>('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) })
      book.editColumns(list => list.map((c, i) => i === index ? { ...c, id: target.id, name: target.name } : c))
      return
    }
    if (book.pending) { notify('Guarda o descarta los cambios antes de renombrar una columna.', 'info'); return }
    try { await book.rename(column.id, name); notify(`Columna renombrada a "${name}".`); onSaved() }
    catch (error) { onError(error instanceof Error ? error.message : 'No se pudo renombrar la columna.') }
  }

  const deleteColumn = async (index: number) => {
    const column = columns[index]
    if (!book.serverColumns.has(column.id)) {
      book.editColumns(list => list.filter((_, i) => i !== index))
      setDrafts(current => new Map([...current].filter(([key]) => !key.endsWith(`:${column.id}`))))
      return
    }
    if (book.pending) { notify('Guarda o descarta los cambios antes de eliminar una columna.', 'info'); return }
    const graded = students.filter(s => original.has(cellKey(s.id, column.id))).length
    if (graded && !await confirm({ title: `¿Eliminar "${column.name}"?`, body: `Se borrarán ${graded === 1 ? 'la nota' : `las ${graded} notas`} de esta columna en ${period}. Las demás columnas no cambian.`, confirm: 'Eliminar columna', danger: true })) return
    try { await book.remove(column.id); notify(`Columna "${column.name}" eliminada.`); onSaved() }
    catch (error) { onError(error instanceof Error ? error.message : 'No se pudo eliminar la columna.') }
  }

  const moveColumn = (index: number, step: -1 | 1) => book.editColumns(list => {
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(index + step, 0, item)
    return next
  })
  const setWeight = (index: number, text: string) => book.editColumns(list => list.map((c, i) => i === index ? { ...c, weight: text } : c))
  const spreadEvenly = () => { const even = evenWeights(columns.length); book.editColumns(list => list.map((c, i) => ({ ...c, weight: plainNumber(even[i]) }))) }
  const fillMissing = () => { const filled = fillMissingWeights(weights); book.editColumns(list => list.map((c, i) => ({ ...c, weight: plainNumber(filled[i]) }))) }
  const adjustTo100 = () => { const scaled = scaleWeightsTo100(weights.map(w => w ?? 0)); book.editColumns(list => list.map((c, i) => ({ ...c, weight: plainNumber(scaled[i]) }))) }
  const clearWeights = () => book.editColumns(list => list.map(c => ({ ...c, weight: '' })))

  const save = async () => {
    if (book.blocker) { notify(book.blocker, 'error'); return }
    if (!book.pending || !period) return
    setSaving(true)
    try {
      const result = await book.save()
      if (result) {
        const parts = [result.saved ? `${result.saved} ${result.saved === 1 ? 'nota guardada' : 'notas guardadas'}` : '', result.cleared ? `${result.cleared} borrada${result.cleared === 1 ? '' : 's'}` : ''].filter(Boolean)
        notify(`${period}: ${parts.length ? parts.join(', ') : 'columnas y porcentajes guardados'}.`)
        onSaved()
      }
    } catch (error) { onError(error instanceof Error ? error.message : 'No se pudieron guardar las notas.') }
    finally { setSaving(false) }
  }

  const changeScale = async (next: number) => {
    if (!await guard('Si cambias la escala')) return
    const sample = plainNumber(Math.round(4 / 5 * next * 100) / 100)
    const ok = await confirm({ title: `¿Calificar sobre ${plainNumber(next)}?`, body: `Las notas no cambian, solo cómo se escriben: un 4,0 sobre 5 se verá como ${sample} sobre ${plainNumber(next)}. Se aprueba con ${plainNumber(next * 0.6)}.`, confirm: 'Cambiar escala' })
    if (!ok) return
    try { await book.changeScale(next); notify(`Ahora el curso se califica de 0 a ${plainNumber(next)}.`); onScaleChanged() }
    catch (error) { onError(error instanceof Error ? error.message : 'No se pudo cambiar la escala.') }
  }

  const addStudent = async () => {
    const text = newStudent.trim()
    if (!text) return
    setAddingStudent(true)
    try {
      const result = await request<{ created: string[]; skipped: string[] }>(`/api/courses/${courseId}/students/quick`, { method: 'POST', body: JSON.stringify({ text }) })
      if (result.created.length) {
        setNewStudent(''); await book.reloadRoster(); onSaved()
        notify(`${result.created[0]} quedó en la lista.`)
        window.setTimeout(() => table.current?.querySelector<HTMLInputElement>('.add-row input')?.focus(), 50)
      } else notify(result.skipped[0] ?? 'No se agregó el estudiante.', 'info')
    } catch (error) { onError(error instanceof Error ? error.message : 'No se pudo agregar el estudiante.') }
    finally { setAddingStudent(false) }
  }

  const download = async () => {
    const { downloadCourseGradeWorkbook } = await import('../../lib/templates')
    await downloadCourseGradeWorkbook(courseId, courseName)
  }

  function focusCell(row: number, col: number) {
    const input = table.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)
    if (input) { input.focus(); input.select() }
    else if (row >= students.length) table.current?.querySelector<HTMLInputElement>('.add-row input')?.focus()
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>, row: number, col: number, key: CellKey) => {
    const input = event.currentTarget
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
    const atEnd = input.selectionStart === input.value.length
    if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); focusCell(event.shiftKey ? row - 1 : row + 1, col) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusCell(row - 1, col) }
    else if (event.key === 'ArrowRight' && atEnd) { event.preventDefault(); focusCell(row, col + 1) }
    else if (event.key === 'ArrowLeft' && atStart) { event.preventDefault(); focusCell(row, col - 1) }
    else if (event.key === 'Escape') { setDrafts(current => { const next = new Map(current); next.delete(key); return next }) }
    else if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); void save() }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>, row: number, col: number) => {
    const text = event.clipboardData.getData('text')
    if (!/[\t\n]/.test(text.trim())) return
    event.preventDefault()
    const filled = pasteBlock(text, { row, col }, students.map(s => s.id), columns.map(c => c.id))
    setDrafts(current => new Map([...current, ...filled]))
    notify(`Pegué ${filled.size} ${filled.size === 1 ? 'nota' : 'notas'} desde tu hoja de cálculo. Revisa y guarda.`, 'info')
  }

  if (book.loading && !sheet) return <div className="grade-editor-skeleton" aria-label="Cargando planilla"><Spinner /> Abriendo la planilla…</div>
  if (!students.length) return <EmptyState icon={<Table2 size={22} />} art="read" title="Primero agrega estudiantes" text="La planilla tiene una fila por estudiante. Agrega la lista y vuelve aquí para escribir las notas."
    action={<button className="btn btn-primary" onClick={onQuickAdd}><Plus size={16} aria-hidden />Agregar estudiantes</button>} />

  const columnAverage = (subjectId: number) => rowAverage(students.map(s => valueOf(cellKey(s.id, subjectId))))
  const weighted = book.weighting.kind !== 'equal'
  const weightNote = book.weighting.kind === 'equal' ? 'Todas las columnas pesan lo mismo.'
    : book.weighting.kind === 'complete' ? 'Los porcentajes suman 100 %.'
    : book.weighting.kind === 'incomplete' ? `Llevas ${plainNumber(book.weighting.sum)} %; falta el porcentaje de ${book.weighting.missing === 1 ? 'una columna' : `${book.weighting.missing} columnas`}.`
    : `Los porcentajes suman ${plainNumber(book.weighting.sum)} %; deben sumar 100 %.`

  return <div className="grade-editor">
    <div className="grade-editor-bar">
      <div className="period-tabs" role="tablist" aria-label="Corte">
        {periods.map(p => <button key={p} role="tab" aria-selected={!showingFinal && p === period} className={!showingFinal && p === period ? 'is-on' : ''} onClick={() => void openPeriod(p)}>{p}</button>)}
        <button className="period-new" onClick={() => void newPeriod()}><Plus size={14} aria-hidden />Nuevo corte</button>
        <button role="tab" aria-selected={showingFinal} className={`period-final${showingFinal ? ' is-on' : ''}`} onClick={() => void openPeriod(FINAL)}><Sigma size={14} aria-hidden />Definitiva</button>
      </div>
      <div className="grade-editor-actions">
        <ScalePicker key={max} max={max} disabled={saving} onChange={value => void changeScale(value)} />
        {!showingFinal && (addingColumn ? <form className="topic-form" onSubmit={event => { event.preventDefault(); void addColumn() }}>
          <input value={columnName} onChange={event => setColumnName(event.target.value)} placeholder="Ej.: Parcial 1, Quiz, Proyecto" aria-label="Nombre de la columna" autoFocus maxLength={100} />
          <button className="btn btn-primary btn-small">Agregar</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setAddingColumn(false)}>Cancelar</button>
        </form> : <button className="btn btn-ghost btn-small" onClick={() => setAddingColumn(true)}><Plus size={15} aria-hidden />Columna</button>)}
        <button className="btn btn-ghost btn-small" onClick={() => void download()}><Download size={15} aria-hidden />Excel del curso</button>
      </div>
    </div>

    {showingFinal ? <FinalGrades students={students} trends={trends} projections={projections} sim={sim} saveScheme={saveScheme} courseName={courseName} />
    : columns.length === 0 ? <EmptyState icon={<Table2 size={22} />} title={`Arma las columnas de ${period}`} text="Cada actividad es una columna: “Parcial 1”, “Taller de Observer”, “Proyecto”… Después puedes darle a cada una su porcentaje."
      action={<button className="btn btn-primary" onClick={() => setAddingColumn(true)}><Plus size={16} aria-hidden />Agregar columna</button>} />
    : <>
      {sheet?.suggested && <p className="sheet-notice" role="status">Copié las columnas y porcentajes de {periods[periods.indexOf(period ?? '') - 1] ?? 'el corte anterior'}. Cámbialas si este corte se evalúa distinto; se guardan con las notas.</p>}
      <div className={`weight-bar is-${book.weighting.kind}`}>
        <Percent size={15} aria-hidden />
        <span>{weightNote}</span>
        <div className="weight-actions">
          {book.weighting.kind === 'incomplete' && <button className="link-btn" onClick={fillMissing}>Repartir lo que falta</button>}
          {book.weighting.kind === 'off' && <button className="link-btn" onClick={adjustTo100}>Ajustar a 100 % sin cambiar proporciones</button>}
          {book.weighting.kind !== 'complete' && <button className="link-btn" onClick={spreadEvenly}>{weighted ? 'Repartir en partes iguales' : 'Poner porcentajes'}</button>}
          {weighted && <button className="link-btn" onClick={clearWeights}>Quitar porcentajes</button>}
        </div>
      </div>
      <div className="sheet-scroll">
        <table ref={table} className={`grade-sheet${book.loading ? ' is-loading' : ''}`} aria-label={`Notas de ${period}`}>
          <thead><tr>
            <th scope="col" className="sheet-name">Estudiante<small>{students.length} en la lista · sobre {plainNumber(max)}</small></th>
            {columns.map((column, index) => <th key={column.id} scope="col">
              <ColumnHeader name={column.name} weight={column.weight} weightInvalid={book.badWeights.includes(column.id)} average={columnAverage(column.id)} max={max}
                first={index === 0} last={index === columns.length - 1}
                onWeight={text => setWeight(index, text)} onRename={name => void renameColumn(index, name)}
                onMove={step => moveColumn(index, step)} onDelete={() => void deleteColumn(index)} />
            </th>)}
            <th scope="col" className="sheet-avg">Nota del corte<small>{weighted ? 'ponderada' : 'promedio'}</small></th>
          </tr></thead>
          <tbody>{students.map((student, row) => {
            const avg = weightedAverage(columns.map(c => valueOf(cellKey(student.id, c.id))), weights)
            return <tr key={student.id}>
              <th scope="row" className="sheet-name"><b>{student.name}</b></th>
              {columns.map((column, col) => {
                const key = cellKey(student.id, column.id)
                const text = textOf(key)
                const parsed = parseGrade(text, max)
                const edited = drafts.has(key) && (parsed.ok ? parsed.value !== (original.get(key) ?? null) : true)
                const low = parsed.ok && parsed.value != null && parsed.value < passing
                return <td key={column.id} className={`${edited ? 'is-edited' : ''}${invalidSet.has(key) ? ' is-invalid' : ''}${low ? ' is-low' : ''}`}>
                  <input value={text} inputMode="decimal" data-row={row} data-col={col} autoComplete="off" spellCheck={false}
                    aria-label={`${student.name}, ${column.name}`} aria-invalid={invalidSet.has(key)} title={parsed.ok ? undefined : parsed.error}
                    onChange={event => { const value = event.target.value; setDrafts(current => new Map(current).set(key, value)) }}
                    onKeyDown={event => onKey(event, row, col, key)} onPaste={event => onPaste(event, row, col)} onFocus={event => event.target.select()} />
                </td>
              })}
              <td className={`sheet-avg num${avg != null && Math.round(avg * 10) < Math.round(passing * 10) ? ' is-low' : ''}`}>{avg != null ? formatScaled(avg, max) : '—'}</td>
            </tr>
          })}
          <tr className="add-row">
            <th scope="row" className="sheet-name" colSpan={1}>
              <form onSubmit={event => { event.preventDefault(); void addStudent() }}>
                <UserPlus size={15} aria-hidden />
                <input value={newStudent} onChange={event => setNewStudent(event.target.value)} placeholder="Agregar estudiante: nombre; correo" aria-label="Nombre y correo del nuevo estudiante" disabled={addingStudent} maxLength={240} />
                {addingStudent && <Spinner size={14} />}
              </form>
            </th>
            <td colSpan={columns.length + 1} className="add-row-hint">{newStudent.trim() ? <>Pulsa <kbd>Enter</kbd> para agregarlo a la lista</> : <>¿Varios a la vez? <button type="button" className="link-btn" onClick={onQuickAdd}>Pega la lista completa</button></>}</td>
          </tr>
          </tbody>
        </table>
      </div>
      <p className="sheet-help">Escribe la nota (de 0 a {plainNumber(max)}) y pulsa <kbd>Enter</kbd> para bajar. Las flechas mueven entre celdas, <kbd>Esc</kbd> deshace la celda y puedes <b>pegar una columna o un bloque copiado de Excel</b>. Toca el nombre de una columna para renombrarla, moverla o eliminarla.</p>
    </>}

    <div className={`save-bar${book.pending || book.invalid.length ? ' is-visible' : ''}`}>
      <span>{book.blocker ?? (book.changes.length
        ? `${book.changes.length} ${book.changes.length === 1 ? 'cambio sin guardar' : 'cambios sin guardar'} en ${period}`
        : `Columnas de ${period} sin guardar`)}</span>
      <div className="button-row">
        <button className="btn btn-ghost-inverse btn-small" onClick={book.discard} disabled={saving}><Undo2 size={15} aria-hidden />Descartar</button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !!book.blocker}>{saving ? <Spinner /> : <Save size={16} aria-hidden />}Guardar</button>
      </div>
    </div>
  </div>
}
