import { useEffect, useState } from 'react'
import { BookOpenCheck, ClipboardCheck, ListChecks, PenLine, Plus, Sparkles } from 'lucide-react'
import { Modal, Spinner } from '../../components/ui'
import { formatGrade, relativeDate } from '../../lib/domain'
import { topicSummary, type TopicSummary } from '../../lib/activities'

const kindLabel = { workshop: 'Taller', quiz: 'Quiz', custom: 'A tu medida' } as const
const kindIcon = { workshop: BookOpenCheck, quiz: ListChecks, custom: PenLine } as const

/**
 * Everything about one topic of the course in one place: how the class did in each corte, the workshops and
 * quizzes made for it and the rubrics that graded it, with shortcuts to create what is missing.
 */
export function TopicPanel({ courseId, subjectId, name, onClose, onOpenActivity, onOpenRubric, onCreate, onCreateRubric }: {
  courseId: number
  subjectId: number
  name: string
  onClose: () => void
  onOpenActivity: (title: string) => void
  onOpenRubric: (id: number) => void
  onCreate: (mode: 'workshop' | 'quiz') => void
  onCreateRubric: (activityId?: number) => void
}) {
  const [data, setData] = useState<TopicSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    topicSummary(courseId, subjectId).then(setData).catch(err => setError(err instanceof Error ? err.message : 'No se pudo cargar el tema.'))
  }, [courseId, subjectId])

  return <Modal title={name} description="Todo lo de este tema: notas por corte, talleres, quizzes y rúbricas." onClose={onClose} size="large">
    {error ? <p className="form-error">{error}</p> : !data ? <div className="mini-loading"><Spinner /> Reuniendo lo del tema…</div> : <div className="topic-panel">
      <section>
        <h3>Notas</h3>
        {data.columns.length ? <ul className="topic-columns">{data.columns.map(column => <li key={column.period}>
          <span>{column.period}</span><b className={`num${column.average != null && column.average < 3 ? ' is-low' : ''}`}>{column.average != null ? formatGrade(column.average) : '—'}</b><small>{column.graded} notas</small>
        </li>)}</ul> : <p className="muted">Todavía no hay notas en este tema.</p>}
      </section>

      <section>
        <div className="topic-section-head"><h3>Talleres y quizzes</h3>
          <div className="button-row"><button className="btn btn-ghost btn-small" onClick={() => onCreate('workshop')}><Sparkles size={14} aria-hidden />Crear taller</button>
            <button className="btn btn-ghost btn-small" onClick={() => onCreate('quiz')}><Plus size={14} aria-hidden />Crear quiz</button></div></div>
        {data.activities.length ? <ul className="topic-list">{data.activities.map(activity => {
          const Icon = kindIcon[activity.kind]
          const rubric = data.rubrics.find(r => r.activityId === activity.id)
          return <li key={activity.id}>
            <button className="topic-item" onClick={() => onOpenActivity(activity.title)}>
              <Icon size={16} aria-hidden /><span><b>{activity.title}</b><small>{kindLabel[activity.kind]} · {relativeDate(activity.createdAt)}</small></span>
            </button>
            {rubric ? <button className="chip" onClick={() => onOpenRubric(rubric.id)}><ClipboardCheck size={13} aria-hidden />Ver rúbrica</button>
              : activity.kind !== 'quiz' && <button className="chip" onClick={() => onCreateRubric(activity.id)}><ClipboardCheck size={13} aria-hidden />Crear rúbrica</button>}
          </li>
        })}</ul> : <p className="muted">Aún no hay talleres de este tema. Créalo desde aquí y queda enlazado.</p>}
      </section>

      <section>
        <h3>Rúbricas</h3>
        {data.rubrics.length ? <ul className="topic-list">{data.rubrics.map(rubric => <li key={rubric.id}>
          <button className="topic-item" onClick={() => onOpenRubric(rubric.id)}>
            <ClipboardCheck size={16} aria-hidden /><span><b>{rubric.title}</b><small>{rubric.scored} evaluados{rubric.columnName ? ` · en ${rubric.period}, ${rubric.columnName}` : ''}</small></span>
          </button>
        </li>)}</ul> : <p className="muted">Sin rúbricas para este tema.</p>}
      </section>
    </div>}
  </Modal>
}
