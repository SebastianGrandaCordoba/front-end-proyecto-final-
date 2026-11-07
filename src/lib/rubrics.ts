import { request } from '../api'

/** What each level says is observed in the work, from Excelente to Insuficiente. */
export interface RubricLevels { excellent: string; good: string; basic: string; insufficient: string }
export interface RubricCriterion { id?: number | null; name: string; description: string; weight: number; levels: RubricLevels }
export interface RubricDraft { title: string; description: string; criteria: RubricCriterion[] }
export interface RubricSummary { id: number; title: string; criteria: number; scored: number; students: number; period: string | null; columnName: string | null; updatedAt: string }
export interface RubricResult { studentId: number; levels: Record<string, number>; comment: string | null; grade: number | null }
export interface RubricDetail extends RubricDraft {
  id: number
  criteria: (RubricCriterion & { id: number })[]
  students: { id: number; name: string }[]
  results: RubricResult[]
  maxGrade: number
  levelGrades: number[]
  period: string | null
  columnName: string | null
}

export const LEVELS = [
  { key: 'excellent', label: 'Excelente' },
  { key: 'good', label: 'Bueno' },
  { key: 'basic', label: 'Básico' },
  { key: 'insufficient', label: 'Insuficiente' },
] as const

/** Same rule as the backend: each level is a share of the maximum grade, weighted by criterion. */
export const LEVEL_SHARE = [1, 0.8, 0.6, 0.3] as const

export function rubricGrade(criteria: { id: number; weight: number }[], levels: Record<string, number | undefined>, max: number) {
  if (!criteria.length) return null
  let earned = 0
  let total = 0
  for (const criterion of criteria) {
    const level = levels[String(criterion.id)]
    if (level == null) return null
    earned += criterion.weight * LEVEL_SHARE[level]
    total += criterion.weight
  }
  return total > 0 ? Math.round(earned / total * max * 100) / 100 : null
}

export const weightSum = (criteria: { weight: number }[]) => Math.round(criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0) * 100) / 100

export const emptyCriterion = (weight = 0): RubricCriterion => ({ name: '', description: '', weight, levels: { excellent: '', good: '', basic: '', insufficient: '' } })

/** A starting point to edit by hand: four common criteria with plain descriptors. */
export function blankRubric(title = 'Nueva rúbrica'): RubricDraft {
  const make = (name: string, weight: number, what: string): RubricCriterion => ({
    name, description: `Evalúa ${what}.`, weight,
    levels: {
      excellent: `${name}: completo, correcto y bien justificado.`,
      good: `${name}: completo, con fallas menores que no afectan el resultado.`,
      basic: `${name}: cumple lo mínimo, con errores o sin justificar.`,
      insufficient: `${name}: incompleto, incorrecto o ausente.`,
    },
  })
  return {
    title, description: '',
    criteria: [make('Dominio del tema', 40, 'si aplica correctamente los conceptos'), make('Procedimiento', 30, 'el paso a paso y las decisiones tomadas'),
      make('Presentación', 15, 'orden, claridad y formato de la entrega'), make('Conclusiones', 15, 'si interpreta y justifica el resultado')],
  }
}

/** The text of a saved workshop that the AI turns into a rubric. */
export function activityFromWorkshop(workshop: { title: string; summary: string; activities: { title: string; instructions: string; deliverable?: string }[]; learningObjectives: string[] }) {
  return [
    `Actividad: ${workshop.title}`,
    workshop.summary,
    `Objetivos: ${workshop.learningObjectives.join('; ')}`,
    ...workshop.activities.map((a, i) => `${i + 1}. ${a.title}${a.deliverable ? ` — Entrega: ${a.deliverable}` : ''}\n${a.instructions.slice(0, 500)}`),
  ].join('\n').slice(0, 6000)
}

const base = (courseId: number) => `/api/courses/${courseId}/rubrics`
export const rubricApi = {
  list: (courseId: number) => request<RubricSummary[]>(base(courseId)),
  get: (courseId: number, id: number) => request<RubricDetail>(`${base(courseId)}/${id}`),
  generate: (courseId: number, body: { activity: string; criteriaCount: number; teacherPrompt?: string }) =>
    request<RubricDraft>(`${base(courseId)}/generate`, { method: 'POST', body: JSON.stringify(body) }),
  create: (courseId: number, draft: RubricDraft) => request<RubricDetail>(base(courseId), { method: 'POST', body: JSON.stringify(draft) }),
  update: (courseId: number, id: number, draft: RubricDraft) => request<RubricDetail>(`${base(courseId)}/${id}`, { method: 'PUT', body: JSON.stringify(draft) }),
  remove: (courseId: number, id: number) => request<void>(`${base(courseId)}/${id}`, { method: 'DELETE' }),
  score: (courseId: number, id: number, studentId: number, body: { levels: Record<string, number | null>; comment?: string | null }) =>
    request<RubricResult>(`${base(courseId)}/${id}/students/${studentId}`, { method: 'PUT', body: JSON.stringify(body) }),
  publish: (courseId: number, id: number, body: { period: string; columnName: string }) =>
    request<{ published: number; pending: number; period: string; columnName: string }>(`${base(courseId)}/${id}/publish`, { method: 'POST', body: JSON.stringify(body) }),
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)

/** A printable sheet of the rubric, to hand out before the activity so students know how they are graded. */
export function rubricHtml(rubric: RubricDraft, courseName: string, levelGrades: number[]) {
  const e = escapeHtml
  const value = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  const rows = rubric.criteria.map(c => `<tr><th><b>${e(c.name)}</b><small>${e(c.description)}</small><span>${value(c.weight)} %</span></th>${LEVELS.map(l => `<td>${e(c.levels[l.key])}</td>`).join('')}</tr>`).join('')
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>${e(rubric.title)}</title><style>
body{font-family:"Instrument Sans",Inter,Arial,sans-serif;color:#15232b;margin:0;padding:28px;background:#f4f5f2}main{max-width:1100px;margin:auto;background:#fff;border:1px solid #e4e7e6;border-radius:14px;padding:36px}
.brand{color:#17708a;font-size:13px;font-weight:600}h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:32px;margin:10px 0 4px}p{color:#55636b}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13.5px;line-height:1.45}th,td{border:1px solid #e4e7e6;padding:10px;vertical-align:top;text-align:left}
thead th{background:#f2f7f8;font-size:13px}thead th small{display:block;color:#55636b;font-weight:500}tbody th{width:22%}tbody th small{display:block;color:#55636b;font-weight:400;margin-top:4px}tbody th span{display:inline-block;margin-top:6px;padding:1px 8px;border-radius:99px;background:#e6f1f3;color:#17708a;font-size:12px}
footer{margin-top:16px;color:#55636b;font-size:12px}@media print{body{padding:0;background:#fff}main{border:0;padding:12mm;max-width:none}}
</style><body><main><div class="brand">FairTeam · Rúbrica · ${e(courseName)}</div><h1>${e(rubric.title)}</h1>${rubric.description ? `<p>${e(rubric.description)}</p>` : ''}
<table><thead><tr><th>Criterio</th>${LEVELS.map((l, i) => `<th>${l.label}<small>${value(levelGrades[i] ?? 0)}</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
<footer>La nota es el promedio ponderado del nivel alcanzado en cada criterio.</footer></main></body></html>`
}
