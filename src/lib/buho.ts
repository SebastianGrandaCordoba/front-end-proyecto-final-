import type { AcademicLevel } from '../api'
import type { Route } from '../app/router'
import type { SupportMode } from '../app/types'
import type { Candidate } from './domain'

/* Búho's brain lives in the backend: its rules (insights.domain.assistant, a Chain of Responsibility) answer
   first, and the AI interpreter reads long or follow-up requests. The browser sends the question with the last
   turns of the conversation, speaks the answer and runs the actions it returns. */

export type BuhoAction =
  | { kind: 'navigate'; label: string; route: Route; params?: Record<string, string> }
  | { kind: 'workshop'; label: string; mode: SupportMode; level: AcademicLevel; topic?: string; student?: Candidate; auto?: boolean; prompt?: string }
  | { kind: 'rubric'; label: string; topic?: string; target?: 'workshop' | 'quiz'; activityId?: number; prompt?: string }
  | { kind: 'review'; label: string; student: Candidate }
  | { kind: 'message'; label: string; student: Candidate }
  | { kind: 'report'; label: string }
  | { kind: 'briefing'; label: string }
  | { kind: 'course'; label: string; courseId: number }

export type BuhoItem = { student: Candidate; value: string; note: string; tone: 'low' | 'medium' | 'high' | 'none' }
export type ApiAction = { kind: string; label: string; params: Record<string, string> }
/** `api` keeps what the server sent so the next question can carry it back as conversation memory. */
export type BuhoReply = { text: string; items?: BuhoItem[]; actions?: BuhoAction[]; run?: BuhoAction; followUps?: string[]; api?: { actions: ApiAction[]; run: ApiAction | null } }
export type ApiReply = { text: string; intent: string; items: { studentId: number; name: string; value: string; note: string; tone: BuhoItem['tone'] }[]; actions: ApiAction[]; run: ApiAction | null }

export const examples = [
  '¿Cómo va el curso?',
  '¿Quién necesita refuerzo en Funciones?',
  '¿Quién viene bajando?',
  '¿Qué nota necesita Valentina para pasar?',
  'Crea un quiz de ciclos para refuerzo',
  'Escríbele un mensaje a Santiago',
  '¿Por qué Valentina está en riesgo?',
  '¿Qué me recomiendas?',
  'Compara los cortes',
  'Genera el informe del curso',
]

function adaptAction(action: ApiAction, students: Map<number, Candidate>): BuhoAction | null {
  const p = action.params ?? {}
  const student = p.studentId ? students.get(Number(p.studentId)) : undefined
  switch (action.kind) {
    case 'navigate': { const { route, ...rest } = p; return { kind: 'navigate', label: action.label, route: (route || 'inicio') as Route, params: Object.keys(rest).length ? rest : undefined } }
    case 'workshop': return { kind: 'workshop', label: action.label, mode: p.mode === 'quiz' || p.mode === 'custom' ? p.mode : 'workshop', level: (p.level || 'LOW') as AcademicLevel, topic: p.topic, student, auto: p.auto === 'true', prompt: p.prompt }
    case 'rubric': return { kind: 'rubric', label: action.label, topic: p.topic, target: p.target === 'quiz' ? 'quiz' : 'workshop', activityId: p.activityId ? Number(p.activityId) : undefined, prompt: p.prompt }
    case 'review': return student ? { kind: 'review', label: action.label, student } : null
    case 'message': return student ? { kind: 'message', label: action.label, student } : null
    case 'report': return { kind: 'report', label: action.label }
    case 'briefing': return { kind: 'briefing', label: action.label }
    case 'course': return p.courseId ? { kind: 'course', label: action.label, courseId: Number(p.courseId) } : null
    default: return null
  }
}

/** Natural next questions after each kind of answer, so the conversation keeps going. */
export const followUpsByIntent: Record<string, string[]> = {
  briefing: ['¿Quién viene bajando?', '¿Qué me recomiendas?'],
  'falling-behind': ['¿Quién puede perder la materia?', 'Compara los cortes'],
  'who-needs-help': ['¿Qué tema les cuesta más?', 'Crea un taller de refuerzo'],
  'passing-grade': ['¿Quién viene bajando?', 'Abre el simulador'],
  'student-status': ['¿Qué me recomiendas?'],
  'subject-extremes': ['¿Quién necesita refuerzo?'],
  'teacher-advice': ['Genera el informe del curso'],
  average: ['¿Qué tema les cuesta más?'],
}

export function adaptReply(api: ApiReply, candidates: Candidate[]): BuhoReply {
  const students = new Map(candidates.map(c => [c.id, c]))
  return {
    text: api.text,
    items: api.items.map(item => students.get(item.studentId) ? { student: students.get(item.studentId)!, value: item.value, note: item.note, tone: item.tone } : null).filter((x): x is BuhoItem => x !== null),
    actions: api.actions.map(a => adaptAction(a, students)).filter((x): x is BuhoAction => x !== null),
    run: api.run ? adaptAction(api.run, students) ?? undefined : undefined,
    followUps: followUpsByIntent[api.intent] ?? [],
    api: { actions: api.actions, run: api.run },
  }
}

export type HistoryTurn = { from: 'teacher' | 'buho'; text: string; offered?: ApiAction[]; ran?: ApiAction | null }

/** The last turns of the conversation, as the backend reads them (it remembers what Búho offered and did). */
export function conversationHistory(messages: { from: 'me' | 'buho'; text: string; reply?: BuhoReply }[], limit = 10): HistoryTurn[] {
  return messages.slice(-limit).map(m => m.from === 'me'
    ? { from: 'teacher', text: m.text.slice(0, 600) }
    : { from: 'buho', text: m.text.slice(0, 600), offered: m.reply?.api?.actions ?? [], ran: m.reply?.api?.run ?? null })
}
