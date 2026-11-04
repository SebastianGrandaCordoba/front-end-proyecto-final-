import type { Course, CourseMaterial, GeneratedWorkshop } from '../api'
import { plural, type Candidate, type CourseSummary, type SubjectInsight } from './domain'

/** Every action the assistant can recommend maps to one concrete control in the app. */
export type AssistantAction =
  | { kind: 'create-course' }
  | { kind: 'import-roster' }
  | { kind: 'import-grades' }
  | { kind: 'upload-material' }
  | { kind: 'support-group' }
  | { kind: 'open-followup' }
  | { kind: 'open-students-ungraded' }
  | { kind: 'open-workshop'; title: string }
  | { kind: 'open-teams' }

export type Recommendation = {
  id: string
  tone: 'urgent' | 'next' | 'idea' | 'done'
  title: string
  detail: string
  cta: string
  action: AssistantAction
}

export type SetupStep = { id: string; label: string; done: boolean }

export type AssistantInput = {
  course: Course | null
  courses: Course[]
  candidates: Candidate[]
  summary: CourseSummary
  materials: CourseMaterial[] | null
  workshops: GeneratedWorkshop[]
  weakest: SubjectInsight | null
}

export function setupSteps({ course, summary, materials }: AssistantInput): SetupStep[] {
  return [
    { id: 'course', label: 'Crear el curso', done: Boolean(course) },
    { id: 'roster', label: 'Cargar la lista de estudiantes', done: summary.students > 0 },
    { id: 'grades', label: 'Cargar las notas', done: summary.gradeCount > 0 },
    { id: 'material', label: 'Guardar material de clase', done: (materials?.length ?? 0) > 0 },
  ]
}

/** One line that answers "¿qué está pasando en mi curso?" — the greeting's subline. */
export function headline({ course, summary, weakest }: AssistantInput): string {
  if (!course) return 'Empecemos creando tu primer curso.'
  if (!summary.students) return `${course.name} está listo. Falta cargar la lista de estudiantes.`
  if (!summary.gradeCount) return `${plural(summary.students, 'estudiante', 'estudiantes')} en ${course.name}. Carga las notas para saber cómo van.`
  if (summary.low) {
    const subject = weakest && weakest.average < 3.5 ? ` El tema con promedio más bajo es ${weakest.name}.` : ''
    return `${plural(summary.low, 'estudiante necesita', 'estudiantes necesitan')} refuerzo en ${course.name}.${subject}`
  }
  return `${course.name} va bien: nadie está por debajo de 3,0.`
}

/** Ordered list of what the teacher should do next, built only from real course data. */
export function recommendations(input: AssistantInput): Recommendation[] {
  const { course, courses, summary, materials, workshops, weakest, candidates } = input
  const list: Recommendation[] = []

  if (!course) {
    list.push({ id: 'course', tone: 'next', title: courses.length ? 'Elige el curso con el que vas a trabajar' : 'Crea tu primer curso', detail: 'Cada curso guarda por separado su lista, sus notas y su material.', cta: courses.length ? 'Ver mis cursos' : 'Crear curso', action: { kind: 'create-course' } })
    return list
  }
  if (!summary.students) {
    list.push({ id: 'roster', tone: 'next', title: 'Carga la lista de estudiantes', detail: 'Sube el Excel o CSV del grupo; solo el nombre es obligatorio.', cta: 'Importar lista', action: { kind: 'import-roster' } })
  } else if (!summary.gradeCount) {
    list.push({ id: 'grades', tone: 'next', title: 'Carga las notas del curso', detail: 'Con las notas te digo quién necesita refuerzo y en qué tema.', cta: 'Importar notas', action: { kind: 'import-grades' } })
  }

  if (summary.low) {
    const lowest = [...candidates].filter(c => c.hasGrades && c.level === 'LOW').sort((a, b) => a.average - b.average)[0]
    const hasMaterial = (materials?.length ?? 0) > 0
    list.push({
      id: 'support',
      tone: 'urgent',
      title: `Prepara un refuerzo para ${plural(summary.low, 'estudiante', 'estudiantes')}`,
      detail: `${weakest && weakest.average < 3.5 ? `${weakest.name} tiene el promedio más bajo. ` : ''}${lowest ? `El caso más urgente es ${lowest.name}.` : ''}${hasMaterial ? '' : ' Primero guarda el material del tema.'}`.trim(),
      cta: hasMaterial ? 'Preparar taller' : 'Subir material',
      action: hasMaterial ? { kind: 'support-group' } : { kind: 'upload-material' },
    })
  }

  if (summary.students && summary.gradeCount && summary.ungraded) {
    list.push({ id: 'ungraded', tone: 'next', title: `${plural(summary.ungraded, 'estudiante no tiene', 'estudiantes no tienen')} notas`, detail: 'Sin notas no puedo saber cómo van. Revisa si faltan en el archivo.', cta: 'Ver quiénes', action: { kind: 'open-students-ungraded' } })
  }

  if (materials && !materials.length && !list.some(item => item.action.kind === 'upload-material')) {
    list.push({ id: 'material', tone: 'next', title: 'Guarda el material de clase', detail: 'PDF, Word o TXT. Lo uso para crear talleres y quizzes sobre lo que enseñas.', cta: 'Subir material', action: { kind: 'upload-material' } })
  }

  if (summary.medium) {
    list.push({ id: 'followup', tone: 'idea', title: `Vigila a ${plural(summary.medium, 'estudiante', 'estudiantes')} en seguimiento`, detail: 'Están entre 3,0 y 4,0. Un quiz corto te dice si van mejorando.', cta: 'Ver seguimiento', action: { kind: 'open-followup' } })
  }

  const latest = workshops[0]
  if (latest) {
    list.push({ id: 'latest', tone: 'idea', title: 'Revisa tu último taller antes de usarlo', detail: latest.title, cta: 'Abrir taller', action: { kind: 'open-workshop', title: latest.title } })
  }

  if (summary.gradeCount && !summary.low && !summary.ungraded) {
    list.push({ id: 'teams', tone: 'done', title: 'Tu curso está al día', detail: 'Puedes armar equipos equilibrados para el próximo proyecto.', cta: 'Armar equipos', action: { kind: 'open-teams' } })
  }
  return list
}
