import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { request } from '../../api'
import { Spinner, useFeedback } from '../../components/ui'
import { relativeDate } from '../../lib/domain'

export type InterventionKind = 'CONVERSATION' | 'TUTORING' | 'WORKSHOP' | 'MESSAGE' | 'FAMILY' | 'OTHER'
type Intervention = { id: number; studentId: number; kind: InterventionKind; note: string; createdAt: string }

export const kindLabel: Record<InterventionKind, string> = {
  CONVERSATION: 'Conversación', TUTORING: 'Tutoría', WORKSHOP: 'Taller', MESSAGE: 'Mensaje', FAMILY: 'Familia', OTHER: 'Otro',
}
const KINDS = Object.keys(kindLabel) as InterventionKind[]

/** What the teacher already did for this student, so the next step builds on it instead of repeating it. */
export function SupportLog({ courseId, studentId, studentName }: { courseId: number; studentId: number; studentName: string }) {
  const { notify, confirm } = useFeedback()
  const [items, setItems] = useState<Intervention[] | null>(null)
  const [kind, setKind] = useState<InterventionKind>('CONVERSATION')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const base = `/api/courses/${courseId}/students/${studentId}/interventions`

  useEffect(() => {
    let active = true
    request<Intervention[]>(base).then(list => { if (active) setItems(list) }).catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [base])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const created = await request<Intervention>(base, { method: 'POST', body: JSON.stringify({ kind, note: note.trim() }) })
      setItems(list => [created, ...(list ?? [])]); setNote(''); setAdding(false)
      notify('Apoyo registrado.')
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo registrar.', 'error') }
    finally { setSaving(false) }
  }

  const remove = async (item: Intervention) => {
    if (!await confirm({ title: '¿Borrar este registro?', body: `${kindLabel[item.kind]} con ${studentName}.`, confirm: 'Borrar', danger: true })) return
    try { await request<void>(`${base}/${item.id}`, { method: 'DELETE' }); setItems(list => (list ?? []).filter(i => i.id !== item.id)) }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo borrar.', 'error') }
  }

  return <section className="support-log">
    <div className="support-head"><h3>Acompañamiento</h3>
      {!adding && <button className="btn btn-ghost btn-small" type="button" onClick={() => setAdding(true)}><Plus size={15} aria-hidden />Registrar apoyo</button>}</div>
    {adding && <form className="support-form" onSubmit={add}>
      <div className="kind-chips" role="radiogroup" aria-label="Tipo de apoyo">
        {KINDS.map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip${kind === k ? ' is-on' : ''}`} onClick={() => setKind(k)}>{kindLabel[k]}</button>)}
      </div>
      <input value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder="Qué acordaron o qué hiciste (opcional)…" aria-label="Nota del apoyo" autoFocus />
      <div className="button-row">
        <button className="btn btn-ghost btn-small" type="button" onClick={() => setAdding(false)}>Cancelar</button>
        <button className="btn btn-primary btn-small" disabled={saving}>{saving && <Spinner />}Guardar</button>
      </div>
    </form>}
    {items == null ? <p className="muted">Cargando…</p>
      : items.length ? <ol className="timeline">{items.map(item => <li key={item.id}>
        <span className={`timeline-dot kind-${item.kind.toLowerCase()}`} aria-hidden />
        <div><b>{kindLabel[item.kind]}</b> <small>{relativeDate(item.createdAt)}</small>{item.note && <p>{item.note}</p>}</div>
        <button className="icon-btn icon-danger" type="button" onClick={() => void remove(item)} aria-label="Borrar registro"><Trash2 size={14} /></button>
      </li>)}</ol>
        : !adding && <p className="muted">Aún no has registrado apoyos. Anotar lo que hablas con cada estudiante te ayuda a darle seguimiento.</p>}
  </section>
}
