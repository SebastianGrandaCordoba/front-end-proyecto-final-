import { request, type GeneratedWorkshop, type Grade } from '../api'

/** A saved workshop, quiz or custom activity as the server returns it. */
export interface ActivityView {
  id: number
  kind: 'workshop' | 'quiz' | 'custom'
  title: string
  topic: string | null
  subjectId: number | null
  targetLevel: string | null
  content: GeneratedWorkshop
  createdAt: string
  rubrics: number
}

export function fromActivity(view: ActivityView): GeneratedWorkshop {
  const content = view.content ?? ({} as GeneratedWorkshop)
  // Older or hand-made entries may lack lists or a level: fill them so every screen can render them.
  return {
    ...content, id: view.id, title: view.title, topic: view.topic, supportType: view.kind, savedAt: view.createdAt, rubricCount: view.rubrics,
    targetLevel: content.targetLevel ?? view.targetLevel ?? 'MEDIUM', subject: content.subject ?? '', summary: content.summary ?? '',
    learningObjectives: content.learningObjectives ?? [], activities: content.activities ?? [], assessment: content.assessment ?? [], sourceReferences: content.sourceReferences ?? [],
  }
}

export function toActivity(workshop: GeneratedWorkshop) {
  const { id: _id, rubricCount: _count, ...content } = workshop
  return { kind: workshop.supportType ?? 'workshop', title: workshop.title, topic: workshop.topic ?? null, targetLevel: workshop.targetLevel, content }
}

/** Everything the platform knows about one topic of the course. */
export interface TopicSummary {
  subjectId: number
  topic: string
  activities: ActivityView[]
  rubrics: { id: number; title: string; activityId: number | null; period: string | null; columnName: string | null; scored: number }[]
  columns: { period: string; subjectId: number; name: string; average: number | null; graded: number }[]
}

export const topicSummary = (courseId: number, subjectId: number) => request<TopicSummary>(`/api/courses/${courseId}/topics/${subjectId}`)

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * The same summary built from what the page already has (grades and saved workshops), for when the server
 * cannot answer: an older server without this endpoint, or a moment without connection. Rubrics need the server.
 */
export function localTopicSummary(subjectId: number, name: string, grades: Grade[], workshops: GeneratedWorkshop[]): TopicSummary {
  const byPeriod = new Map<string, number[]>()
  for (const grade of grades) {
    if (grade.subjectId !== subjectId) continue
    const value = Number(grade.grade)
    if (!Number.isFinite(value)) continue
    byPeriod.set(grade.period, [...(byPeriod.get(grade.period) ?? []), value])
  }
  const columns = [...byPeriod.entries()].sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    .map(([period, values]) => ({ period, subjectId, name, average: values.reduce((sum, v) => sum + v, 0) / values.length, graded: values.length }))
  const wanted = plain(name)
  const activities: ActivityView[] = workshops
    .filter(w => w.id != null && (plain(w.topic ?? '') === wanted || plain(w.title).includes(wanted)))
    .map(w => ({ id: w.id!, kind: w.supportType ?? 'workshop', title: w.title, topic: w.topic ?? null, subjectId, targetLevel: w.targetLevel ?? null,
      content: w, createdAt: w.savedAt ?? new Date().toISOString(), rubrics: w.rubricCount ?? 0 }))
  return { subjectId, topic: name, activities, rubrics: [], columns }
}
