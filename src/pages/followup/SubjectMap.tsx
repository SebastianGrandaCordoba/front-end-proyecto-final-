import type { PageProps } from '../../App'
import { EmptyState } from '../../components/ui'
import Heatmap from '../../components/Heatmap'
import { type Candidate } from '../../lib/domain'

export function SubjectMap({ workspace, review }: { workspace: PageProps['workspace']; review: (s: Candidate) => void }) {
  const subjects = workspace.insights.map(s => s.name)
  if (!subjects.length) return <div className="panel"><EmptyState art="read" title="Aún no hay notas por tema" text="Cuando cargues notas con su materia, verás aquí quién va bien y quién no en cada tema." /></div>
  return <>
    <p className="explainer">Cada celda es el promedio del estudiante en ese tema. Los temas van del más difícil al más fácil, así ves de un vistazo dónde reforzar.</p>
    <ul className="heat-legend" aria-label="Leyenda"><li><i className="heat-low" />Menos de 3,0</li><li><i className="heat-medium" />3,0 a 3,9</li><li><i className="heat-high" />4,0 o más</li><li><i className="heat-none" />Sin notas</li></ul>
    <Heatmap trends={workspace.trends} subjects={subjects} onSelect={review} />
  </>
}
