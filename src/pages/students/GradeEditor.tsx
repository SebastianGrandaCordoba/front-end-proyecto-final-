import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Download, Plus, Save, Table2, Undo2 } from 'lucide-react'
import { request } from '../../api'
import { EmptyState, Spinner, useFeedback } from '../../components/ui'
import { formatGrade } from '../../lib/domain'
import { cellKey, diff, formatCell, nextPeriodName, parseGrade, pasteBlock, rowAverage, type CellKey } from '../../lib/gradeSheet'

interface Sheet {
  period: string
  periods: string[]
  subjects: { id: number; name: string }[]
  students: { id: number; name: string; email?: string | null }[]
  cells: { studentId: number; subjectId: number; grade: number }[]
}

/**
 * Spreadsheet-like editor for one corte. Typing never saves on its own: changes are collected,
 * checked as you type and saved together, so a slip of the keyboard is easy to undo.
 */
export function GradeEditor({ courseId, courseName, onSaved, onQuickAdd }: { courseId: number; courseName: string; onSaved: () => void; onQuickAdd: () => void }) {
  const { notify, confirm } = useFeedback()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [period, setPeriod] = useState<string | null>(null)
  const [extraPeriods, setExtraPeriods] = useState<string[]>([])
  const [extraSubjects, setExtraSubjects] = useState<{ id: number; name: string }[]>([])
  const [drafts, setDrafts] = useState<Map<CellKey, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicName, setTopicName] = useState('')
  const table = useRef<HTMLTableElement>(null)

  const load = useCallback(async (wanted: string | null) => {
    setLoading(true)
    try {
      const query = wanted ? `?period=${encodeURIComponent(wanted)}` : ''
      const data = await request<Sheet>(`/api/courses/${courseId}/grade-sheet${query}`)
      setSheet(data); setPeriod(data.period); setDrafts(new Map())
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo abrir la planilla.', 'error') }
    finally { setLoading(false) }
  }, [courseId, notify])

  useEffect(() => { void load(null) }, [load])

  const subjects = useMemo(() => {
    const all = [...(sheet?.subjects ?? [])]
    for (const extra of extraSubjects) if (!all.some(s => s.id === extra.id)) all.push(extra)
    return all
  }, [sheet, extraSubjects])
  const students = sheet?.students ?? []
  const original = useMemo(() => new Map((sheet?.cells ?? []).map(c => [cellKey(c.studentId, c.subjectId), Number(c.grade)])), [sheet])
  const periods = useMemo(() => {
    const list = [...(sheet?.periods ?? [])]
    for (const p of [...extraPeriods, period ?? '']) if (p && !list.includes(p)) list.push(p)
    return list
  }, [sheet, extraPeriods, period])
  const { changes, invalid } = useMemo(() => diff(original, drafts), [original, drafts])
  const invalidSet = useMemo(() => new Set(invalid), [invalid])

  const textOf = (key: CellKey) => drafts.has(key) ? drafts.get(key)! : formatCell(original.get(key))
  const valueOf = (key: CellKey) => { const parsed = parseGrade(textOf(key)); return parsed.ok ? parsed.value : null }

  const guard = async () => !changes.length || confirm({ title: 'Tienes notas sin guardar', body: 'Si cambias de corte se perderán los cambios.', confirm: 'Descartar cambios', danger: true })

  const openPeriod = async (next: string) => { if (next !== period && await guard()) void load(next) }
  const newPeriod = async () => {
    if (!await guard()) return
    const name = nextPeriodName(periods)
    setExtraPeriods(list => [...list, name])
    void load(name)
  }

  const addTopic = async () => {
    const name = topicName.trim()
    if (!name) return
    const existing = subjects.find(s => s.name.toLowerCase() === name.toLowerCase())
    if (existing) { notify(`"${existing.name}" ya es una columna.`, 'info'); return }
    try {
      // Topics are shared by all of the teacher's courses: reuse one with the same name instead of duplicating it.
      const known = await request<{ id: number; name: string }[]>('/api/subjects')
      const created = known.find(s => s.name.trim().toLowerCase() === name.toLowerCase())
        ?? await request<{ id: number; name: string }>('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) })
      setExtraSubjects(list => [...list, created]); setTopicName(''); setAddingTopic(false)
      window.setTimeout(() => focusCell(0, subjects.length), 50)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo agregar el tema.', 'error') }
  }

  const save = async () => {
    if (invalid.length) { notify(`Revisa ${invalid.length === 1 ? 'la nota marcada en rojo' : `las ${invalid.length} notas marcadas en rojo`}.`, 'error'); return }
    if (!changes.length || !period) return
    setSaving(true)
    try {
      const result = await request<{ saved: number; cleared: number; sheet: Sheet }>(`/api/courses/${courseId}/grade-sheet`, { method: 'PUT', body: JSON.stringify({ period, changes }) })
      setSheet(result.sheet); setDrafts(new Map()); setExtraSubjects([])
      notify(`${period}: ${result.saved} ${result.saved === 1 ? 'nota guardada' : 'notas guardadas'}${result.cleared ? `, ${result.cleared} borrada${result.cleared === 1 ? '' : 's'}` : ''}.`)
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudieron guardar las notas.', 'error') }
    finally { setSaving(false) }
  }

  const download = async () => {
    const { downloadCourseGradeWorkbook } = await import('../../lib/templates')
    await downloadCourseGradeWorkbook(courseId, courseName)
  }

  function focusCell(row: number, col: number) {
    const input = table.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)
    if (input) { input.focus(); input.select() }
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
    const filled = pasteBlock(text, { row, col }, students.map(s => s.id), subjects.map(s => s.id))
    setDrafts(current => new Map([...current, ...filled]))
    notify(`Pegué ${filled.size} ${filled.size === 1 ? 'nota' : 'notas'} desde tu hoja de cálculo. Revisa y guarda.`, 'info')
  }

  if (loading && !sheet) return <div className="grade-editor-skeleton" aria-label="Cargando planilla"><Spinner /> Abriendo la planilla…</div>
  if (!students.length) return <EmptyState icon={<Table2 size={22} />} art="read" title="Primero agrega estudiantes" text="La planilla tiene una fila por estudiante. Agrega la lista y vuelve aquí para escribir las notas."
    action={<button className="btn btn-primary" onClick={onQuickAdd}><Plus size={16} aria-hidden />Agregar estudiantes</button>} />

  const columnAverage = (subjectId: number) => rowAverage(students.map(s => valueOf(cellKey(s.id, subjectId))))

  return <div className="grade-editor">
    <div className="grade-editor-bar">
      <div className="period-tabs" role="tablist" aria-label="Corte">
        {periods.map(p => <button key={p} role="tab" aria-selected={p === period} className={p === period ? 'is-on' : ''} onClick={() => void openPeriod(p)}>{p}</button>)}
        <button className="period-new" onClick={() => void newPeriod()}><Plus size={14} aria-hidden />Nuevo corte</button>
      </div>
      <div className="grade-editor-actions">
        {addingTopic ? <form className="topic-form" onSubmit={event => { event.preventDefault(); void addTopic() }}>
          <input value={topicName} onChange={event => setTopicName(event.target.value)} placeholder="Nombre del tema o actividad" aria-label="Nombre del tema" autoFocus maxLength={100} />
          <button className="btn btn-primary btn-small">Agregar</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setAddingTopic(false)}>Cancelar</button>
        </form> : <button className="btn btn-ghost btn-small" onClick={() => setAddingTopic(true)}><Plus size={15} aria-hidden />Tema</button>}
        <button className="btn btn-ghost btn-small" onClick={() => void download()}><Download size={15} aria-hidden />Excel del curso</button>
      </div>
    </div>

    {subjects.length === 0 ? <EmptyState icon={<Table2 size={22} />} title="Agrega el primer tema" text="Cada tema o actividad es una columna: por ejemplo “Parcial 1”, “Taller de Observer” o “Proyecto”."
      action={<button className="btn btn-primary" onClick={() => setAddingTopic(true)}><Plus size={16} aria-hidden />Agregar tema</button>} />
      : <div className="sheet-scroll">
        <table ref={table} className={`grade-sheet${loading ? ' is-loading' : ''}`} aria-label={`Notas de ${period}`}>
          <thead><tr>
            <th scope="col" className="sheet-name">Estudiante</th>
            {subjects.map(subject => { const avg = columnAverage(subject.id); return <th key={subject.id} scope="col"><span>{subject.name}</span><small>{avg != null ? `prom. ${formatGrade(avg)}` : 'sin notas'}</small></th> })}
            <th scope="col" className="sheet-avg">Promedio<small>del corte</small></th>
          </tr></thead>
          <tbody>{students.map((student, row) => {
            const avg = rowAverage(subjects.map(subject => valueOf(cellKey(student.id, subject.id))))
            return <tr key={student.id}>
              <th scope="row" className="sheet-name"><b>{student.name}</b></th>
              {subjects.map((subject, col) => {
                const key = cellKey(student.id, subject.id)
                const text = textOf(key)
                const parsed = parseGrade(text)
                const edited = drafts.has(key) && (parsed.ok ? parsed.value !== (original.get(key) ?? null) : true)
                const low = parsed.ok && parsed.value != null && parsed.value < 3
                return <td key={subject.id} className={`${edited ? 'is-edited' : ''}${invalidSet.has(key) ? ' is-invalid' : ''}${low ? ' is-low' : ''}`}>
                  <input value={text} inputMode="decimal" data-row={row} data-col={col} autoComplete="off" spellCheck={false}
                    aria-label={`${student.name}, ${subject.name}`} aria-invalid={invalidSet.has(key)} title={parsed.ok ? undefined : parsed.error}
                    onChange={event => { const value = event.target.value; setDrafts(current => new Map(current).set(key, value)) }}
                    onKeyDown={event => onKey(event, row, col, key)} onPaste={event => onPaste(event, row, col)} onFocus={event => event.target.select()} />
                </td>
              })}
              <td className={`sheet-avg num${avg != null && Math.round(avg * 10) / 10 < 3 ? ' is-low' : ''}`}>{avg != null ? formatGrade(avg) : '—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}

    <p className="sheet-help">Escribe la nota y pulsa <kbd>Enter</kbd> para bajar. Las flechas mueven entre celdas, <kbd>Esc</kbd> deshace la celda y puedes <b>pegar una columna o un bloque copiado de Excel</b>. Deja la celda vacía para borrar la nota.</p>

    <div className={`save-bar${changes.length || invalid.length ? ' is-visible' : ''}`}>
      <span>{invalid.length ? `${invalid.length} ${invalid.length === 1 ? 'nota no es válida' : 'notas no son válidas'}` : `${changes.length} ${changes.length === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}`} en {period}</span>
      <div className="button-row">
        <button className="btn btn-ghost-inverse btn-small" onClick={() => setDrafts(new Map())} disabled={saving}><Undo2 size={15} aria-hidden />Descartar</button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !!invalid.length}>{saving ? <Spinner /> : <Save size={16} aria-hidden />}Guardar notas</button>
      </div>
    </div>
  </div>
}
