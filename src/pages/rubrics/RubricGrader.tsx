import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { PartyPopper } from 'lucide-react'
import { Check, ChevronLeft, ChevronRight, Search, Send } from 'lucide-react'
import { Avatar, useFeedback } from '../../components/ui'
import { formatScaled } from '../../lib/domain'
import { plainNumber } from '../../lib/gradeSheet'
import { LEVELS, rubricApi, rubricGrade, type RubricDetail, type RubricResult } from '../../lib/rubrics'
import { guideDone } from '../../lib/guide'

/**
 * Assessing with a rubric: pick a student, click the level reached in each criterion (or press 1–4) and
 * the grade appears at once. Every click is saved, so the teacher can stop and continue later.
 */
export function RubricGrader({ courseId, rubric, onResults, onPublish }: {
  courseId: number
  rubric: RubricDetail
  onResults: (results: RubricResult[]) => void
  onPublish: () => void
}) {
  const { notify } = useFeedback()
  const [results, setResults] = useState(() => new Map(rubric.results.map(r => [r.studentId, r])))
  const resultsRef = useRef(results)
  resultsRef.current = results
  const listRef = useRef<HTMLUListElement>(null)
  const [studentId, setStudentId] = useState<number | null>(() => rubric.students.find(s => !isDone(rubric.results.find(r => r.studentId === s.id)))?.id ?? rubric.students[0]?.id ?? null)
  const [cursor, setCursor] = useState(0)
  const [query, setQuery] = useState('')
  const [comment, setComment] = useState('')
  const board = useRef<HTMLDivElement>(null)
  const max = rubric.maxGrade
  const passing = max * 0.6

  function isDone(result?: RubricResult) {
    return !!result && rubric.criteria.every(c => result.levels[String(c.id)] != null)
  }

  const current = studentId != null ? results.get(studentId) : undefined
  const levels = current?.levels ?? {}
  const grade = rubricGrade(rubric.criteria, levels, max)
  const done = rubric.students.filter(s => isDone(results.get(s.id))).length
  const index = rubric.students.findIndex(s => s.id === studentId)
  const visible = useMemo(() => rubric.students.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase())), [rubric.students, query])

  useEffect(() => {
    setComment(current?.comment ?? ''); setCursor(0)
    // Keep the student being graded visible in the list and bring the criteria back to the top.
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (studentId != null) board.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    board.current?.focus({ preventScroll: true })
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const store = (result: RubricResult) => setResults(map => new Map(map).set(result.studentId, result))
  // Tell the page after rendering (never from inside a state update).
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } onResults([...results.values()]) }, [results]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (criterionId: number, level: number | null) => {
    if (studentId == null) return
    const before = results.get(studentId)
    const nextLevels = { ...(before?.levels ?? {}) }
    if (level == null) delete nextLevels[String(criterionId)]; else nextLevels[String(criterionId)] = level
    store({ studentId, levels: nextLevels, comment: before?.comment ?? null, grade: rubricGrade(rubric.criteria, nextLevels, max) })
    // The last criterion of this student: move on by itself to the next one still pending.
    const finished = level != null && rubric.criteria.every(c => nextLevels[String(c.id)] != null)
      && !(before && rubric.criteria.every(c => before.levels[String(c.id)] != null))
    if (finished) window.setTimeout(() => advance(studentId), 450)
    try { store(await rubricApi.score(courseId, rubric.id, studentId, { levels: { [criterionId]: level } })); guideDone('calificar') }
    catch (error) {
      if (before) store(before)
      notify(error instanceof Error ? error.message : 'No se pudo guardar el nivel.', 'error')
    }
  }

  const saveComment = async () => {
    if (studentId == null || (current?.comment ?? '') === comment.trim()) return
    try { store(await rubricApi.score(courseId, rubric.id, studentId, { levels: {}, comment: comment.trim() })) }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el comentario.', 'error') }
  }

  /** Next student without a full evaluation (after the current one, then from the top). */
  const advance = (fromId: number) => {
    const order = rubric.students
    const at = order.findIndex(s => s.id === fromId)
    const pending = [...order.slice(at + 1), ...order.slice(0, at)].find(s => s.id !== fromId && !isDone(resultsRef.current.get(s.id)))
    void saveComment()
    if (pending) setStudentId(pending.id)
    else setStudentId(null)
  }

  const go = (step: -1 | 1) => {
    const next = rubric.students[index + step]
    if (next) { void saveComment(); setStudentId(next.id) }
  }

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === 'TEXTAREA' || (event.target as HTMLElement).tagName === 'INPUT') return
    const number = Number(event.key)
    if (number >= 1 && number <= 4) {
      event.preventDefault()
      const criterion = rubric.criteria[cursor]
      if (!criterion) return
      void choose(criterion.id, number - 1)
      if (cursor < rubric.criteria.length - 1) setCursor(cursor + 1)
    } else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(c => Math.min(rubric.criteria.length - 1, c + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
    else if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); go(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1) }
  }

  if (!rubric.students.length) return <p className="muted">Este curso no tiene estudiantes todavía.</p>
  const student = index >= 0 ? rubric.students[index] : null

  return <div className="grader">
    <aside className="grader-list" aria-label="Estudiantes">
      <div className="grader-progress"><b>{done} de {rubric.students.length}</b> evaluados<div className="gen-bar" aria-hidden><span style={{ transform: `scaleX(${done / rubric.students.length})` }} /></div></div>
      <label className="grader-search"><Search size={14} aria-hidden /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar estudiante" aria-label="Buscar estudiante" /></label>
      <ul ref={listRef}>{visible.map(s => {
        const r = results.get(s.id)
        const g = isDone(r) ? r!.grade ?? rubricGrade(rubric.criteria, r!.levels, max) : null
        return <li key={s.id}><button className={s.id === studentId ? 'is-on' : ''} onClick={() => { void saveComment(); setStudentId(s.id) }} aria-current={s.id === studentId}>
          <span className="grader-name">{s.name}</span>
          {g != null ? <span className={`grader-grade num${g < passing ? ' is-low' : ''}`}>{formatScaled(g, max)}</span>
            : r && Object.keys(r.levels).length ? <span className="grader-partial">{Object.keys(r.levels).length}/{rubric.criteria.length}</span> : null}
        </button></li>
      })}</ul>
    </aside>

    {!student && <div className="grader-board grader-done" ref={board} tabIndex={-1}>
      <PartyPopper size={36} aria-hidden />
      <h3>Evaluaste a los {rubric.students.length} estudiantes</h3>
      <p>Revisa cualquier nota en la lista de la izquierda. Cuando estés listo, llévalas al libro de notas.</p>
      <button className="btn btn-primary btn-large" onClick={onPublish}><Send size={17} aria-hidden />Llevar {done} notas al libro</button>
    </div>}
    {student && <div className="grader-board" ref={board} tabIndex={0} onKeyDown={onKey} aria-label={`Evaluación de ${student.name}`}>
      <header className="grader-head">
        <Avatar name={student.name} size={40} />
        <div><h3>{student.name}</h3><small>{index + 1} de {rubric.students.length} · teclas 1 a 4 para elegir el nivel, flechas para moverte</small></div>
        <div className={`grader-total${grade != null && grade < passing ? ' is-low' : ''}`} aria-live="polite">
          {grade != null ? <><b className="num">{formatScaled(grade, max)}</b><small>de {plainNumber(max)}</small></> : <small>{Object.keys(levels).length}/{rubric.criteria.length} criterios</small>}
        </div>
        <div className="grader-nav">
          <button className="icon-btn" onClick={() => go(-1)} disabled={index <= 0} aria-label="Estudiante anterior"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => go(1)} disabled={index >= rubric.students.length - 1} aria-label="Siguiente estudiante"><ChevronRight size={18} /></button>
        </div>
      </header>

      <ol className="grader-criteria">{rubric.criteria.map((criterion, ci) => {
        const chosen = levels[String(criterion.id)]
        return <li key={criterion.id} className={ci === cursor ? 'is-cursor' : ''} onClick={() => setCursor(ci)}>
          <div className="grader-crit-head"><b>{criterion.name}</b><span className="muted">{plainNumber(criterion.weight)} %</span>{chosen != null && <Check size={15} className="grader-check" aria-label="Evaluado" />}</div>
          <div className="level-options" role="radiogroup" aria-label={criterion.name}>
            {LEVELS.map((level, li) => <button key={level.key} type="button" role="radio" aria-checked={chosen === li}
              className={`level-option lvl-${li}${chosen === li ? ' is-on' : ''}`} onClick={() => void choose(criterion.id, chosen === li ? null : li)}>
              <span className="level-top"><kbd>{li + 1}</kbd><b>{level.label}</b><span className="num">{plainNumber(rubric.levelGrades[li])}</span></span>
              <span className="level-text">{criterion.levels[level.key]}</span>
            </button>)}
          </div>
        </li>
      })}</ol>

      <label className="grader-comment"><span>Comentario para {student.name.split(' ')[0]} <small className="muted">opcional</small></span>
        <textarea rows={2} maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} onBlur={() => void saveComment()}
          placeholder="Qué hizo bien y qué puede mejorar" />
      </label>
      <div className="grader-foot">
        {done > 0 && <button className={`btn ${done === rubric.students.length ? 'btn-primary' : 'btn-ghost'}`} onClick={onPublish}><Send size={15} aria-hidden />Llevar {done} {done === 1 ? 'nota' : 'notas'} al libro{done < rubric.students.length ? ` (faltan ${rubric.students.length - done})` : ''}</button>}
        <span className="push" />
        {index < rubric.students.length - 1 && <button className="btn btn-secondary" onClick={() => go(1)}>Siguiente estudiante<ChevronRight size={16} aria-hidden /></button>}
      </div>
    </div>}
  </div>
}
