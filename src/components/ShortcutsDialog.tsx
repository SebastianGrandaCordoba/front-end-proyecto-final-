import { Modal } from './ui'

const shortcuts: [string, string][] = [
  ['Ctrl + K', 'Abrir o cerrar el Búho'],
  ['?', 'Ver estos atajos'],
  ['g luego i', 'Ir a Inicio'],
  ['g luego e', 'Ir a Estudiantes y notas'],
  ['g luego s', 'Ir a Seguimiento'],
  ['g luego t', 'Ir a Talleres y quizzes'],
  ['g luego r', 'Ir a Rúbricas'],
  ['g luego q', 'Ir a Equipos'],
  ['g luego c', 'Ir a Mis cursos'],
  ['Esc', 'Cerrar ventanas y el Búho'],
]

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="Atajos de teclado" description="Para moverte por FairTeam sin el ratón." onClose={onClose} size="small">
    <dl className="shortcuts">{shortcuts.map(([keys, what]) => <div key={keys}><dt>{keys.split(' ').map((k, i) => k === 'luego' || k === '+' ? <span key={i}> {k} </span> : <kbd key={i}>{k}</kbd>)}</dt><dd>{what}</dd></div>)}</dl>
  </Modal>
}
