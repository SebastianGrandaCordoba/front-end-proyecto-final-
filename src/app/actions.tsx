import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { FileUp, Upload, Users } from 'lucide-react'
import { request, type CourseMaterial, type Grade, type Student } from '../api'
import { spreadsheetFileAsCsv } from '../spreadsheet'
import { plural } from '../lib/domain'
import { Spinner, useFeedback } from '../components/ui'

const sheetAccept = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
const materialAccept = '.pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const MAX_MATERIAL_BYTES = 10 * 1024 * 1024

/** Imports a roster or grade sheet straight from wherever the button sits (home, students, empty states). */
export function ImportButton({ kind, courseId, onDone, variant = 'secondary', children }: { kind: 'roster' | 'grades'; courseId: number | null; onDone: () => void; variant?: 'primary' | 'secondary'; children?: ReactNode }) {
  const { notify } = useFeedback()
  const [busy, setBusy] = useState(false)
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!courseId) return notify('Primero elige un curso.', 'error')
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return notify('El archivo debe ser Excel (.xlsx, .xls) o CSV.', 'error')
    setBusy(true)
    try {
      const csv = await spreadsheetFileAsCsv(file, kind)
      const form = new FormData(); form.append('file', csv)
      if (kind === 'roster') {
        const imported = await request<Student[]>(`/api/students/import?courseId=${courseId}`, { method: 'POST', body: form })
        notify(`Listo: ${plural(imported.length, 'estudiante cargado', 'estudiantes cargados')}.`)
      } else {
        const imported = await request<Grade[]>(`/api/grades/import?courseId=${courseId}`, { method: 'POST', body: form })
        notify(`Listo: ${plural(imported.length, 'nota cargada', 'notas cargadas')}.`)
      }
      onDone()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo importar el archivo. Revisa que tenga los encabezados de la plantilla.', 'error')
    } finally { setBusy(false) }
  }
  const label = children ?? (kind === 'roster' ? 'Importar lista' : 'Importar notas')
  return <label className={`btn btn-${variant}${busy ? ' is-busy' : ''}${!courseId ? ' is-disabled' : ''}`}>
    <input type="file" className="visually-hidden" accept={sheetAccept} onChange={onFile} disabled={busy || !courseId} />
    {busy ? <Spinner /> : kind === 'roster' ? <Users size={16} aria-hidden /> : <Upload size={16} aria-hidden />}
    {busy ? 'Importando…' : label}
  </label>
}

export async function uploadMaterial(courseId: number, file: File) {
  const form = new FormData(); form.append('file', file)
  return request<CourseMaterial>(`/api/courses/${courseId}/materials`, { method: 'POST', body: form })
}

export function validateMaterial(file: File): string | null {
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) return 'El material debe ser PDF, Word (.docx) o TXT.'
  if (file.size > MAX_MATERIAL_BYTES) return 'El archivo pesa más de 10 MB. Sube un capítulo o una parte más corta.'
  if (!file.size) return 'El archivo está vacío.'
  return null
}

/** Uploads one or more class materials to the course library. */
export function MaterialUploadButton({ courseId, onUploaded, variant = 'secondary', children }: { courseId: number | null; onUploaded: (items: CourseMaterial[]) => void; variant?: 'primary' | 'secondary' | 'ghost'; children?: ReactNode }) {
  const { notify } = useFeedback()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!files.length || !courseId) return
    const valid = files.filter(file => { const problem = validateMaterial(file); if (problem) notify(`${file.name}: ${problem}`, 'error'); return !problem })
    if (!valid.length) return
    setBusy(true)
    const saved: CourseMaterial[] = []
    for (const file of valid) {
      try { saved.push(await uploadMaterial(courseId, file)) }
      catch (error) { notify(`${file.name}: ${error instanceof Error ? error.message : 'no se pudo guardar.'}`, 'error') }
    }
    setBusy(false)
    if (saved.length) { onUploaded(saved); notify(saved.length === 1 ? 'Material guardado en el curso.' : `${saved.length} materiales guardados en el curso.`) }
  }
  return <label className={`btn btn-${variant}${busy ? ' is-busy' : ''}${!courseId ? ' is-disabled' : ''}`}>
    <input ref={input} type="file" multiple className="visually-hidden" accept={materialAccept} onChange={onFiles} disabled={busy || !courseId} />
    {busy ? <Spinner /> : <FileUp size={16} aria-hidden />}
    {busy ? 'Subiendo…' : children ?? 'Subir material'}
  </label>
}
