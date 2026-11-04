import { useMemo, useState } from 'react'
import { Copy, Mail } from 'lucide-react'
import { Modal, Segmented, useFeedback } from '../components/ui'
import type { Projection, Trend } from '../lib/insights'
import { feedbackMessage, mailtoLink } from '../lib/report'

export default function MessageDialog({ trend, projection, teacher, course, onClose }: { trend: Trend; projection: Projection | null; teacher: string; course: string; onClose: () => void }) {
  const { notify } = useFeedback()
  const [tone, setTone] = useState<'cercano' | 'formal'>('cercano')
  const initial = useMemo(() => feedbackMessage({ trend, projection, teacher, course, tone }), [trend, projection, teacher, course, tone])
  const [edited, setEdited] = useState<string | null>(null)
  const text = edited ?? initial
  const subject = `${course}: seguimiento de tu proceso`
  const copy = async () => { try { await navigator.clipboard.writeText(text); notify('Mensaje copiado. Pégalo donde quieras enviarlo.') } catch { notify('No se pudo copiar.', 'error') } }
  return <Modal title={`Mensaje para ${trend.student.name}`} description="Lo redacté con sus notas. Revísalo y ajústalo antes de enviarlo." onClose={onClose} size="large">
    <div className="form">
      <Segmented label="Tono" value={tone} onChange={value => { setTone(value); setEdited(null) }} options={[{ value: 'cercano', label: 'Cercano' }, { value: 'formal', label: 'Formal' }]} />
      <textarea className="message-text" rows={14} value={text} onChange={event => setEdited(event.target.value)} aria-label="Texto del mensaje" />
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => void copy()}><Copy size={16} aria-hidden />Copiar</button>
        {trend.student.email ? <a className="btn btn-primary" href={mailtoLink(trend.student.email, subject, text)}><Mail size={16} aria-hidden />Abrir en mi correo</a> : <span className="muted">Sin correo registrado: cópialo y envíalo por otro medio.</span>}
      </div>
    </div>
  </Modal>
}
