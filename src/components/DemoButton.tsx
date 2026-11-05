import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { request } from '../api'
import { Spinner, useFeedback } from './ui'
import { plural } from '../lib/domain'

type DemoSummary = { createdCourses: string[]; skippedCourses: string[]; students: number; grades: number; materials: number }

/** Loads four fictional courses (three semesters) with rosters, grades and class material. */
export function DemoButton({ onLoaded, variant = 'btn-secondary' }: { onLoaded: () => Promise<void> | void; variant?: string }) {
  const { notify, confirm } = useFeedback()
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const ok = await confirm({
      title: '¿Cargar cursos de demostración?',
      body: 'Se crean 4 cursos de varios semestres con estudiantes ficticios, notas por corte y material de clase en PDF. Tus cursos actuales no cambian.',
      confirm: 'Cargar demostración',
    })
    if (!ok) return
    setLoading(true)
    try {
      const summary = await request<DemoSummary>('/api/demo/workspace', { method: 'POST' })
      await onLoaded()
      if (summary.createdCourses.length) {
        notify(`Listo: ${plural(summary.createdCourses.length, 'curso', 'cursos')}, ${plural(summary.students, 'estudiante', 'estudiantes')}, ${plural(summary.grades, 'nota', 'notas')} y ${plural(summary.materials, 'material', 'materiales')}.`)
      } else {
        notify('Los cursos de demostración ya estaban cargados.', 'info')
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudieron cargar los cursos de demostración.', 'error')
    } finally { setLoading(false) }
  }

  return <button className={`btn ${variant}`} onClick={() => void load()} disabled={loading}>
    {loading ? <Spinner /> : <Sparkles size={16} aria-hidden />}Cargar cursos de demostración
  </button>
}
