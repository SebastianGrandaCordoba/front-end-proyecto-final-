import { Clock3, Copy, Download, FileText, KeyRound, Printer } from 'lucide-react'
import { type GeneratedWorkshop } from '../../api'
import { downloadWorkshopDocument, printWorkshop } from '../../lib/files'
import { levelLabel, levelOf } from '../../lib/domain'

export function WorkshopView({ workshop, onCopy, onNew, onEdit, onQuiz }: { workshop: GeneratedWorkshop; onCopy: () => void; onNew: () => void; onEdit: (next: GeneratedWorkshop) => void; onQuiz?: () => void }) {
  const isQuiz = workshop.supportType === 'quiz'
  const minutes = workshop.activities.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0)
  return <article className="panel workshop">
    <header className="workshop-head">
      <div className="workshop-meta"><span>{isQuiz ? 'Quiz' : 'Taller'}</span><span>{workshop.subject}</span><span>{levelLabel[levelOf(workshop.targetLevel)]}</span>{!isQuiz && minutes > 0 && <span><Clock3 size={13} aria-hidden /> {minutes} min</span>}</div>
      <h2 className="editable" contentEditable suppressContentEditableWarning spellCheck onBlur={event => { const title = event.currentTarget.textContent?.trim(); if (title && title !== workshop.title) onEdit({ ...workshop, title }) }} aria-label="Título del taller, editable">{workshop.title}</h2>
      <p className="editable" contentEditable suppressContentEditableWarning spellCheck onBlur={event => { const summary = event.currentTarget.textContent?.trim(); if (summary && summary !== workshop.summary) onEdit({ ...workshop, summary }) }} aria-label="Resumen del taller, editable">{workshop.summary}</p>
      <small className="edit-hint">Puedes editar el título y el resumen antes de descargar.</small>
    </header>
    <div className="workshop-actions">
      <button className="btn btn-primary" onClick={() => downloadWorkshopDocument(workshop)}><Download size={16} aria-hidden />Para estudiantes</button>
      <button className="btn btn-secondary" onClick={() => downloadWorkshopDocument(workshop, true)}><KeyRound size={16} aria-hidden />Clave docente</button>
      <button className="icon-btn" onClick={() => printWorkshop(workshop)} aria-label="Imprimir o guardar como PDF" title="Imprimir o guardar como PDF"><Printer size={17} /></button>
      <button className="icon-btn" onClick={onCopy} aria-label="Copiar texto" title="Copiar texto"><Copy size={17} /></button>
      {workshop.supportType !== 'quiz' && onQuiz && <button className="btn btn-ghost btn-small push" onClick={onQuiz}>Hacer un quiz del tema</button>}
      <button className={`btn btn-ghost btn-small${workshop.supportType === 'quiz' || !onQuiz ? ' push' : ''}`} onClick={onNew}>Crear otra</button>
    </div>

    <section className="w-section"><h3>Objetivos</h3><ol className="objectives">{workshop.learningObjectives.map((item, index) => <li key={index}>{item}</li>)}</ol></section>
    {!isQuiz && workshop.activities.length > 0 && <section className="w-section"><h3>Actividades</h3>
      <ol className="activities">{workshop.activities.map((activity, index) => <li key={index}>
        <div className="activity-head"><b>{activity.title}</b><span className="num">{activity.estimatedMinutes} min</span></div>
        <p>{activity.instructions}</p>
      </li>)}</ol></section>}
    <section className="w-section"><h3>{isQuiz ? 'Preguntas' : 'Comprobación'}</h3>
      <ol className="questions">{workshop.assessment.map((item, index) => <li key={index}>
        <b>{item.question}</b>
        <ul>{item.options.map((option, i) => <li key={i} className={option === item.correctAnswer ? 'is-answer' : ''}>{option}</li>)}</ul>
        <details><summary>Ver respuesta</summary><p><b>{item.correctAnswer}.</b> {item.explanation}</p></details>
      </li>)}</ol></section>
    <footer className="workshop-foot"><FileText size={14} aria-hidden />Material: {workshop.sourceReferences.join(' · ') || 'no especificado'}. Revisa la propuesta antes de compartirla; el archivo para estudiantes no incluye respuestas.</footer>
  </article>
}
