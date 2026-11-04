import { useState, type FormEvent } from 'react'
import { request, type Project } from '../../api'
import { Field, Modal, Spinner, useFeedback } from '../../components/ui'

export const storedSize = () => { const value = Number(localStorage.getItem('fairteam.defaultTeamSize')); return [2, 3, 4, 5, 6].includes(value) ? value : 3 }

export function ProjectForm({ project, onClose, onSaved }: { project: Project | null; onClose: () => void; onSaved: (project: Project | null) => void }) {
  const { notify } = useFeedback()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [teamSize, setTeamSize] = useState(project?.teamSize ?? storedSize())
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const saved = await request<Project>(project ? `/api/projects/${project.id}` : '/api/projects', { method: project ? 'PUT' : 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim(), teamSize }) })
      notify(project ? 'Proyecto actualizado.' : 'Proyecto creado.')
      onSaved(saved)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo guardar el proyecto.', 'error') }
    finally { setSaving(false) }
  }
  return <Modal title={project ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose} size="small">
    <form className="form" onSubmit={submit}>
      <Field label="Nombre"><input required maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Proyecto final de semestre…" autoComplete="off" /></Field>
      <Field label="Descripción" optional><textarea rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Qué van a construir juntos…" /></Field>
      <Field label="Personas por equipo" hint={project ? 'Se define al crear el proyecto.' : undefined}><select value={teamSize} disabled={Boolean(project)} onChange={event => setTeamSize(Number(event.target.value))}>{[2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value} personas</option>)}</select></Field>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving && <Spinner />}{project ? 'Guardar' : 'Crear proyecto'}</button></div>
    </form>
  </Modal>
}
