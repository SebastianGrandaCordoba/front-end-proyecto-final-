import { useEffect, useState } from 'react'
import { Copy, Mail } from 'lucide-react'
import { request } from '../api'
import { Modal, Segmented, Spinner, useFeedback } from '../components/ui'
import type { Candidate } from '../lib/domain'
import { mailtoLink } from '../lib/report'

type Feedback = { studentId: number; studentName: string; email: string | null; subject: string; body: string }

/** The backend writes the message from the student's grades (FeedbackTemplate); the teacher edits and sends it. */
export default function MessageDialog({ courseId, student, onClose }: { courseId: number; student: Candidate; onClose: () => void }) {
  const { notify } = useFeedback()
  const [tone, setTone] = useState<'cercano' | 'formal' | 'motivador'>('cercano')
  const [draft, setDraft] = useState<Feedback | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setDraft(null); setError('')
    request<Feedback>(`/api/courses/${courseId}/students/${student.id}/feedback?tone=${tone}`)
      .then(result => { if (active) { setDraft(result); setText(result.body) } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'No se pudo redactar el mensaje.') })
    return () => { active = false }
  }, [courseId, student.id, tone])
  const copy = async () => { try { await navigator.clipboard.writeText(text); notify('Mensaje copiado. Pégalo donde quieras enviarlo.') } catch { notify('No se pudo copiar.', 'error') } }
  return <Modal title={`Mensaje para ${student.name}`} description="Lo redacté con sus notas. Revísalo y ajústalo antes de enviarlo." onClose={onClose} size="large">
    <div className="form">
      <Segmented label="Tono" value={tone} onChange={setTone} options={[{ value: 'cercano', label: 'Cercano' }, { value: 'motivador', label: 'Motivador' }, { value: 'formal', label: 'Formal' }]} />
      {error ? <div className="form-error" role="alert">{error}</div>
        : !draft ? <div className="mini-loading"><Spinner /> Redactando…</div>
          : <textarea className="message-text" rows={14} value={text} onChange={event => setText(event.target.value)} aria-label="Texto del mensaje" />}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => void copy()} disabled={!draft}><Copy size={16} aria-hidden />Copiar</button>
        {draft?.email ? <a className="btn btn-primary" href={mailtoLink(draft.email, draft.subject, text)}><Mail size={16} aria-hidden />Abrir en mi correo</a> : draft && <span className="muted">Sin correo registrado: cópialo y envíalo por otro medio.</span>}
      </div>
    </div>
  </Modal>
}
