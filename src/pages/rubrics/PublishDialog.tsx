import { useEffect, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { request } from '../../api'
import { Field, Modal, Spinner, useFeedback } from '../../components/ui'
import { nextPeriodName } from '../../lib/gradeSheet'
import { rubricApi, type RubricDetail } from '../../lib/rubrics'

/** Sends the rubric grades to a column of the grade book, in the corte the teacher chooses. */
export function PublishDialog({ courseId, rubric, done, onClose, onPublished }: {
  courseId: number
  rubric: RubricDetail
  done: number
  onClose: () => void
  onPublished: (period: string) => void
}) {
  const { notify } = useFeedback()
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState(rubric.period ?? '')
  // Its own column, named after the activity: reusing the topic's column would overwrite other grades.
  const [column, setColumn] = useState((rubric.columnName ?? rubric.activityTitle ?? rubric.title.replace(/^Rúbrica:?\s*/i, '')).slice(0, 100))
  const [existing, setExisting] = useState<{ name: string; graded: number }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void request<{ period: string; periods: string[] }>(`/api/courses/${courseId}/grade-sheet`).then(sheet => {
      if (!period) loadColumns(sheet.period)
      const list = sheet.periods.length ? sheet.periods : [sheet.period]
      setPeriods(list)
      setPeriod(current => current || sheet.period)
    }).catch(() => setPeriods(['Corte 1']))
  }, [courseId])

  const loadColumns = (p: string) => {
    void request<{ columns: { id: number; name: string }[]; cells: { subjectId: number }[] }>(`/api/courses/${courseId}/grade-sheet?period=${encodeURIComponent(p)}`)
      .then(sheet => setExisting(sheet.columns.map(c => ({ name: c.name, graded: sheet.cells.filter(cell => cell.subjectId === c.id).length }))))
      .catch(() => setExisting([]))
  }
  useEffect(() => { if (period) loadColumns(period) }, [period]) // eslint-disable-line react-hooks/exhaustive-deps
  const clash = existing.find(c => c.name.trim().toLowerCase() === column.trim().toLowerCase() && c.graded > 0)
  const isOwn = rubric.columnName != null && rubric.columnName.toLowerCase() === column.trim().toLowerCase() && rubric.period === period

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await rubricApi.publish(courseId, rubric.id, { period, columnName: column.trim() })
      notify(`${result.published} ${result.published === 1 ? 'nota quedó' : 'notas quedaron'} en ${result.period}, columna "${result.columnName}".${result.pending ? ` Faltan ${result.pending} por evaluar.` : ''}`)
      onPublished(result.period)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudieron llevar las notas.', 'error') }
    finally { setSaving(false) }
  }

  const options = [...periods, ...(periods.length ? [nextPeriodName(periods)] : [])]
  return <Modal title="Llevar al libro de notas" description={`Se guardan las notas de ${done} ${done === 1 ? 'estudiante evaluado' : 'estudiantes evaluados'} en todos los criterios. Si vuelves a llevarlas, se actualizan.`} onClose={onClose} size="small">
    <form className="publish-form" onSubmit={submit}>
      <Field label="Corte"><select value={period} onChange={event => setPeriod(event.target.value)}>{options.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
      <Field label="Nombre de la columna" hint="Se crea en ese corte si no existe."><input value={column} maxLength={100} onChange={event => setColumn(event.target.value)} required /></Field>
      {clash && !isOwn && <p className="publish-warning" role="alert">La columna “{clash.name}” ya tiene {clash.graded} {clash.graded === 1 ? 'nota' : 'notas'} en {period}. Si sigues, se reemplazan por las de la rúbrica. Usa otro nombre para conservarlas.</p>}
      <div className="button-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving || !period || !column.trim()}>{saving ? <Spinner /> : <Send size={16} aria-hidden />}Llevar notas</button>
      </div>
    </form>
  </Modal>
}
