import { useState } from 'react'
import { BookOpen, Search, Download, Trash2 } from 'lucide-react'
import { type GeneratedWorkshop } from '../../api'
import { EmptyState, Segmented } from '../../components/ui'
import { downloadWorkshopDocument } from '../../lib/files'
import { levelLabel, levelOf, relativeDate } from '../../lib/domain'

export function Library({ items, onOpen, onRemove }: { items: GeneratedWorkshop[]; onOpen: (item: GeneratedWorkshop) => void; onRemove: (item: GeneratedWorkshop) => void }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'todos' | 'workshop' | 'quiz' | 'custom'>('todos')
  if (!items.length) return <div className="panel"><EmptyState icon={<BookOpen size={22} />} title="Todavía no hay propuestas guardadas" text="Cada taller o quiz que generes se guarda aquí, por curso, en este navegador." /></div>
  const q = query.trim().toLowerCase()
  const visible = items.filter(item => (kind === 'todos' || (item.supportType ?? 'workshop') === kind) && (!q || `${item.title} ${item.subject}`.toLowerCase().includes(q)))
  return <>
    <div className="toolbar">
      <label className="search"><Search size={16} aria-hidden /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en tus talleres…" aria-label="Buscar talleres" /></label>
      <Segmented label="Tipo" value={kind} onChange={setKind} options={[{ value: 'todos', label: 'Todos', count: items.length }, { value: 'workshop', label: 'Talleres', count: items.filter(i => (i.supportType ?? 'workshop') === 'workshop').length }, { value: 'quiz', label: 'Quizzes', count: items.filter(i => i.supportType === 'quiz').length }, { value: 'custom', label: 'A tu medida', count: items.filter(i => i.supportType === 'custom').length }]} />
    </div>
    {!visible.length && <div className="panel"><EmptyState title="Nada coincide" text="Prueba con otra palabra o cambia el tipo." /></div>}
    <ul className="library">{visible.map(item => <li key={`${item.title}-${item.savedAt}`} className="panel lib-item">
    <button className="lib-open" onClick={() => onOpen(item)}>
      <span className="lib-type">{item.supportType === 'quiz' ? 'Quiz' : item.supportType === 'custom' ? 'A tu medida' : 'Taller'} · {levelLabel[levelOf(item.targetLevel)]}</span>
      <b>{item.title}</b>
      <small>{item.subject} · {item.supportType === 'quiz' ? `${item.assessment.length} preguntas` : `${item.activities.reduce((s, a) => s + (a.estimatedMinutes || 0), 0)} min`} · {relativeDate(item.savedAt)}</small>
    </button>
    <div className="lib-actions">
      <button className="btn btn-small" onClick={() => onOpen(item)}>Abrir</button>
      <button className="btn btn-small btn-ghost" onClick={() => downloadWorkshopDocument(item)} aria-label={`Descargar ${item.title}`} title="Descargar la versión para estudiantes"><Download size={15} /> Descargar</button>
      <button className="icon-btn icon-danger lib-remove" onClick={() => onRemove(item)} aria-label={`Borrar ${item.title}`} title="Borrar"><Trash2 size={16} /></button>
    </div>
  </li>)}</ul>
  </>
}
