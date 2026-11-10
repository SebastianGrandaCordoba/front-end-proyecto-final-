import { request, type GeneratedWorkshop } from '../api'

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
