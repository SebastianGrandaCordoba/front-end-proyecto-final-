import { useState, type FormEvent } from 'react'
import { request, type Course } from '../../api'
import { Field, Modal, Spinner, useFeedback } from '../../components/ui'

export function CourseForm({ course, onClose, onCreated }: { course?: Course; onClose: () => void; onCreated: (course: Course) => void }) {
  const { notify } = useFeedback()
  const [name, setName] = useState(course?.name ?? '')
  const [period, setPeriod] = useState(course?.period ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const saved = await request<Course>(course ? `/api/courses/${course.id}` : '/api/courses', { method: course ? 'PUT' : 'POST', body: JSON.stringify({ name: name.trim(), period: period.trim() || null, description: description.trim() || null }) })
      onCreated(saved)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el curso.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal title={course ? 'Editar curso' : 'Crear curso'} description={course ? undefined : 'Podrás cargar la lista y las notas enseguida.'} onClose={onClose} size="small">
    <form className="form" onSubmit={submit}>
      <Field label="Nombre del curso"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Programación I · Grupo A…" autoComplete="off" /></Field>
      <Field label="Periodo" optional><input maxLength={40} value={period} onChange={event => setPeriod(event.target.value)} placeholder="Ej. 2026-2…" autoComplete="off" /></Field>
      <Field label="Descripción" optional><textarea rows={2} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Jornada, salón o lo que te ayude a reconocerlo…" /></Field>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{saving ? 'Guardando…' : course ? 'Guardar cambios' : 'Crear curso'}</button></div>
    </form>
  </Modal>
}
