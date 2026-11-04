import { useState, type FormEvent } from 'react'
import { request, type AcademicLevel, type Student } from '../../api'
import { Field, Modal, Spinner, useFeedback } from '../../components/ui'
import { levelOf } from '../../lib/domain'

export function StudentForm({ student, courseId, onClose, onSaved }: { student: Student | null; courseId: number | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useFeedback()
  const [name, setName] = useState(student?.name ?? '')
  const [email, setEmail] = useState(student?.email ?? '')
  const [level, setLevel] = useState<AcademicLevel>(levelOf(student?.academicLevel))
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await request<Student>(student ? `/api/students/${student.id}` : '/api/students', {
        method: student ? 'PUT' : 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, academicLevel: level, courseId }) })
      notify(student ? 'Cambios guardados.' : 'Estudiante agregado.')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal title={student ? 'Editar estudiante' : 'Agregar estudiante'} onClose={onClose} size="small">
    <form className="form" onSubmit={submit}>
      <Field label="Nombre completo"><input name="name" required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Valentina Rojas…" autoComplete="off" /></Field>
      <Field label="Correo" optional><input name="email" type="email" maxLength={180} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@universidad.edu.co…" autoComplete="off" spellCheck={false} /></Field>
      {!student && <Field label="Nivel inicial" hint="Se reemplaza por el promedio en cuanto cargues notas.">
        <select value={level} onChange={event => setLevel(event.target.value as AcademicLevel)}><option value="LOW">Necesita refuerzo</option><option value="MEDIUM">En seguimiento</option><option value="HIGH">Buen progreso</option></select>
      </Field>}
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{saving ? 'Guardando…' : student ? 'Guardar cambios' : 'Agregar estudiante'}</button></div>
    </form>
  </Modal>
}
