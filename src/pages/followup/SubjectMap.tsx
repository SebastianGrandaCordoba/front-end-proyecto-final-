import type { PageProps } from '../../App'
import { EmptyState } from '../../components/ui'
import Heatmap from '../../components/Heatmap'
import { type Candidate } from '../../lib/domain'

export function SubjectMap({ workspace, review }: { workspace: PageProps['workspace']; review: (s: Candidate) => void }) {
  const subjects = workspace.insights.map(s => s.name)
  if (!subjects.length) return <div className="panel"><EmptyState art="read" title="Aún no hay notas por tema" text="Cuando cargues notas con su materia, verás aquí quién va bien y quién no en cada tema." /></div>
  return <>
    <p className="explainer">Cada celda es el promedio del estudiante en ese tema. Los temas van del más difícil al más fácil, así ves de un vistazo dónde reforzar.</p>
    <Heatmap trends={workspace.trends} subjects={subjects} onSelect={review} />
  </>
}
