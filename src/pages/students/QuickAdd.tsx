import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { request } from '../../api'
import { Modal, Spinner, useFeedback } from '../../components/ui'

/** Mirrors the backend parser to preview how many students will be created (one per non-empty line). */
export function countEntries(text: string) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)).length
}

/** Add one student or a whole pasted list without preparing an Excel file. */
export function QuickAdd({ courseId, courseName, onClose, onAdded }: { courseId: number; courseName: string; onClose: () => void; onAdded: () => void }) {
  const { notify } = useFeedback()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const count = useMemo(() => countEntries(text), [text])

  const submit = async () => {
    setSaving(true)
    try {
      const result = await request<{ created: string[]; skipped: string[] }>(`/api/courses/${courseId}/students/quick`, { method: 'POST', body: JSON.stringify({ text }) })
      if (result.created.length) notify(`${result.created.length === 1 ? `${result.created[0]} quedó` : `${result.created.length} estudiantes quedaron`} en ${courseName}.`)
      onAdded()
      if (result.skipped.length) { setSkipped(result.skipped); setText('') } else onClose()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudieron agregar.', 'error') }
    finally { setSaving(false) }
  }

  return <Modal title="Agregar estudiantes" description={`A ${courseName}. Un estudiante por línea; el correo es opcional.`} onClose={onClose} size="medium">
    <form className="quick-add" onSubmit={event => { event.preventDefault(); if (count) void submit() }}>
      <textarea value={text} onChange={event => setText(event.target.value)} rows={8} autoFocus spellCheck={false}
        aria-label="Nombres de los estudiantes, uno por línea"
        placeholder={'Laura Méndez Ríos\nCamilo Rojas Torres; camilo.rojas@universidad.edu.co\n…o pega la columna de nombres desde Excel'}
        onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && count) void submit() }} />
      {skipped.length > 0 && <div className="quick-skipped" role="status"><b>No agregué {skipped.length === 1 ? 'a 1 estudiante' : `a ${skipped.length} estudiantes`}:</b>
        <ul>{skipped.slice(0, 8).map(item => <li key={item}>{item}</li>)}</ul></div>}
      <div className="modal-actions">
        <span className="muted quick-count">{count ? `${count} ${count === 1 ? 'estudiante' : 'estudiantes'} para agregar` : 'Escribe al menos un nombre'}</span>
        <button type="button" className="btn btn-ghost" onClick={onClose}>{skipped.length ? 'Listo' : 'Cancelar'}</button>
        <button className="btn btn-primary" disabled={!count || saving}>{saving ? <Spinner /> : <UserPlus size={16} aria-hidden />}Agregar {count > 1 ? count : ''}</button>
      </div>
    </form>
  </Modal>
}
