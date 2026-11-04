import type { AcademicLevel, Grade, Student } from '../api'

export type Candidate = Student & { level: AcademicLevel; average: number; gradeCount: number; hasGrades: boolean }
export type Subject = { id: number; name: string }
export type SubjectInsight = { id: number; name: string; average: number; count: number; lowCount: number }

export const levelLabel: Record<AcademicLevel, string> = { LOW: 'Necesita refuerzo', MEDIUM: 'En seguimiento', HIGH: 'Buen progreso' }
export const levelShort: Record<AcademicLevel, string> = { LOW: 'Refuerzo', MEDIUM: 'Seguimiento', HIGH: 'Buen progreso' }
export const levelRule: Record<AcademicLevel, string> = {
  LOW: 'Promedio menor a 3,0',
  MEDIUM: 'Promedio de 3,0 a menos de 4,0',
  HIGH: 'Promedio de 4,0 o más',
}

export function levelOf(value?: string | null): AcademicLevel {
  const level = (value || '').toUpperCase()
  if (['LOW', 'BAJO', 'BAJA'].includes(level)) return 'LOW'
  if (['HIGH', 'ALTO', 'ALTA'].includes(level)) return 'HIGH'
  return 'MEDIUM'
}

/** Classify on the value the teacher sees (one decimal), so a 2,97 shown as "3,0" is not called "refuerzo". */
export const round1 = (value: number) => Math.round(value * 10) / 10
/** CSS tone for a grade: low (<3,0), medium (<4,0) or high, on the displayed value. */
export function gradeTone(value: number): 'low' | 'medium' | 'high' {
  const level = levelFromAverage(value)
  return level === 'LOW' ? 'low' : level === 'MEDIUM' ? 'medium' : 'high'
}

export function levelFromAverage(average: number): AcademicLevel {
  const shown = round1(average)
  return shown < 3 ? 'LOW' : shown < 4 ? 'MEDIUM' : 'HIGH'
}

const number1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const formatGrade = (value: number) => number1.format(value)
export const formatInt = (value: number) => new Intl.NumberFormat('es-CO').format(value)
export function plural(count: number, one: string, many: string) { return `${formatInt(count)} ${count === 1 ? one : many}` }

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.slice(0, 2).map(part => part[0]).join('') || '?').toUpperCase()
}

export function firstName(name?: string | null) {
  return (name || '').trim().split(/\s+/)[0] || 'profe'
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export function relativeDate(iso?: string) {
  if (!iso) return ''
  const value = Date.parse(iso)
  if (!Number.isFinite(value)) return ''
  const days = Math.round((Date.now() - value) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(value)
}

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${formatInt(Math.max(1, Math.round(bytes / 1024)))} KB`
  return `${number1.format(bytes / 1024 / 1024)} MB`
}

/** Students with their average computed only from the grades actually loaded. */
export function buildCandidates(students: Student[], grades: Grade[]): Candidate[] {
  const byStudent = new Map<number, number[]>()
  for (const grade of grades) {
    const mark = Number(grade.grade)
    if (!Number.isFinite(mark) || grade.studentId == null) continue
    const list = byStudent.get(Number(grade.studentId)) ?? []
    list.push(mark)
    byStudent.set(Number(grade.studentId), list)
  }
  return students.map(student => {
    const marks = byStudent.get(Number(student.id)) ?? []
    const average = marks.length ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length : NaN
    return {
      ...student,
      average,
      gradeCount: marks.length,
      hasGrades: marks.length > 0,
      level: marks.length ? levelFromAverage(average) : levelOf(student.academicLevel),
    }
  })
}

export type CourseSummary = {
  students: number
  graded: number
  ungraded: number
  low: number
  medium: number
  high: number
  average: number | null
  gradeCount: number
}

export function summarize(candidates: Candidate[], grades: Grade[]): CourseSummary {
  const graded = candidates.filter(student => student.hasGrades)
  const marks = grades.map(grade => Number(grade.grade)).filter(Number.isFinite)
  return {
    students: candidates.length,
    graded: graded.length,
    ungraded: candidates.length - graded.length,
    low: graded.filter(student => student.level === 'LOW').length,
    medium: graded.filter(student => student.level === 'MEDIUM').length,
    high: graded.filter(student => student.level === 'HIGH').length,
    average: marks.length ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length : null,
    gradeCount: marks.length,
  }
}

export function studentAdvice(student: Candidate) {
  if (!student.hasGrades) return 'Todavía no hay notas de este estudiante. Carga una evaluación para saber cómo va; mientras tanto puedes preparar una actividad preventiva.'
  if (student.level === 'LOW') return 'Conviene retomar los conceptos base con ejemplos resueltos, práctica guiada y una comprobación corta al final.'
  if (student.level === 'MEDIUM') return 'Va avanzando. Puede consolidar con ejercicios de aplicación de dificultad creciente y una pregunta para transferir lo aprendido.'
  return 'Muestra buen progreso. Propón un reto de profundización y pídele que explique su estrategia a un compañero.'
}
