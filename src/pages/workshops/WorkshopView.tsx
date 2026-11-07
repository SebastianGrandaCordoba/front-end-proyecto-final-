import { BookOpen, ClipboardCheck, Clock3, Copy, Download, FileText, KeyRound, Layers, Lightbulb, NotebookPen, PackageCheck, Printer, Target } from 'lucide-react'
import { RichText } from '../../components/RichText'
import { ACTIVITY_STYLES } from '../../lib/activityStyles'
import { type GeneratedWorkshop } from '../../api'
import { downloadWorkshopDocument, printWorkshop } from '../../lib/files'
import { levelLabel, levelOf } from '../../lib/domain'
import type { AcademicLevel } from '../../api'

const variantLabel: Record<AcademicLevel, string> = { LOW: 'Refuerzo', MEDIUM: 'Seguimiento', HIGH: 'Reto' }

const kindLabel = { workshop: 'Taller', quiz: 'Quiz', custom: 'A tu medida' } as const

/**
 * The generated activity as the teacher reviews it: what students read first, each activity with its
 * purpose, steps, hints and deliverable, the questions with their key and the notes only the teacher sees.
 */
export function WorkshopView({ workshop, onCopy, onNew, onEdit, onQuiz, onAdjust, onVariant, onRubric }: {
  workshop: GeneratedWorkshop
  onCopy: () => void
  onNew: () => void
  onEdit: (next: GeneratedWorkshop) => void
  onQuiz?: () => void
  onAdjust?: () => void
  onVariant?: (level: AcademicLevel) => void
  onRubric?: () => void
}) {
  const type = workshop.supportType ?? 'workshop'
  const isQuiz = type === 'quiz'
  const minutes = workshop.activities.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0)
  return <article className="panel workshop">
    <header className="workshop-head">
      <div className="workshop-meta"><span>{kindLabel[type]}</span><span>{workshop.subject}</span><span>{levelLabel[levelOf(workshop.targetLevel)]}</span>{!isQuiz && minutes > 0 && <span><Clock3 size={13} aria-hidden /> {minutes} min</span>}</div>
      <h2 className="editable" contentEditable suppressContentEditableWarning spellCheck onBlur={event => { const title = event.currentTarget.textContent?.trim(); if (title && title !== workshop.title) onEdit({ ...workshop, title }) }} aria-label="Título del taller, editable">{workshop.title}</h2>
      <p className="editable" contentEditable suppressContentEditableWarning spellCheck onBlur={event => { const summary = event.currentTarget.textContent?.trim(); if (summary && summary !== workshop.summary) onEdit({ ...workshop, summary }) }} aria-label="Resumen del taller, editable">{workshop.summary}</p>
      {workshop.activityStyles?.some(id => id !== 'GUIDED') && <ul className="style-tags" aria-label="Tipo de trabajo">
        {workshop.activityStyles.map(id => <li key={id}>{ACTIVITY_STYLES.find(style => style.id === id)?.label ?? id}</li>)}</ul>}
      {workshop.teacherPrompt && <p className="prompt-echo"><b>Lo que pediste:</b> {workshop.teacherPrompt}</p>}
    </header>
    <div className="workshop-actions">
      <button className="btn btn-primary" onClick={() => downloadWorkshopDocument(workshop)}><Download size={16} aria-hidden />Para estudiantes</button>
      <button className="btn btn-secondary" onClick={() => downloadWorkshopDocument(workshop, true)}><KeyRound size={16} aria-hidden />Clave docente</button>
      <button className="icon-btn" onClick={() => printWorkshop(workshop)} aria-label="Imprimir o guardar como PDF" title="Imprimir o guardar como PDF"><Printer size={17} /></button>
      <button className="icon-btn" onClick={onCopy} aria-label="Copiar texto" title="Copiar texto"><Copy size={17} /></button>
      <span className="push" />
      {onAdjust && <button className="btn btn-ghost btn-small" onClick={onAdjust}>Ajustar y volver a crear</button>}
      {!isQuiz && onQuiz && <button className="btn btn-ghost btn-small" onClick={onQuiz}>Hacer un quiz del tema</button>}
      <button className="btn btn-ghost btn-small" onClick={onNew}>Crear otra</button>
    </div>
    {(onVariant || onRubric) && <div className="workshop-next" aria-label="Siguientes pasos">
      {onVariant && <div className="variant-row"><Layers size={15} aria-hidden /><span>Misma actividad para otro nivel:</span>
        {(['LOW', 'MEDIUM', 'HIGH'] as const).filter(level => level !== levelOf(workshop.targetLevel)).map(level =>
          <button key={level} className="chip" onClick={() => onVariant(level)}>{variantLabel[level]}</button>)}</div>}
      {onRubric && !isQuiz && <button className="btn btn-secondary btn-small" onClick={onRubric}><ClipboardCheck size={15} aria-hidden />Crear rúbrica para calificarlo</button>}
    </div>}

    {workshop.studentIntro && <section className="w-section w-intro"><h3><BookOpen size={16} aria-hidden />Antes de empezar</h3><RichText text={workshop.studentIntro} /></section>}

    <section className="w-section"><h3><Target size={16} aria-hidden />Lo que van a lograr</h3><ol className="objectives">{workshop.learningObjectives.map((item, index) => <li key={index}>{item}</li>)}</ol></section>

    {!isQuiz && workshop.activities.length > 0 && <section className="w-section"><h3>Actividades</h3>
      <ol className="activities">{workshop.activities.map((activity, index) => <li key={index} className="activity">
        <div className="activity-head"><span className="activity-n" aria-hidden>{index + 1}</span><b>{activity.title}</b><span className="activity-time num"><Clock3 size={13} aria-hidden />{activity.estimatedMinutes} min</span></div>
        {activity.goal && <p className="activity-goal">{activity.goal}</p>}
        <div className="activity-body"><RichText text={activity.instructions} /></div>
        {!!activity.hints?.length && <details className="activity-hints"><summary><Lightbulb size={14} aria-hidden />{activity.hints.length === 1 ? 'Una pista' : `${activity.hints.length} pistas`} si se atascan</summary>
          <ol>{activity.hints.map((hint, i) => <li key={i}>{hint}</li>)}</ol></details>}
        {activity.deliverable && <p className="activity-deliverable"><PackageCheck size={15} aria-hidden /><span><b>Entrega:</b> {activity.deliverable}</span></p>}
      </li>)}</ol></section>}

    {workshop.assessment.length > 0 && <section className="w-section"><h3>{isQuiz ? 'Preguntas' : 'Comprobación'}</h3>
      <ol className="questions">{workshop.assessment.map((item, index) => <li key={index}>
        <b>{item.question}</b>
        {item.options.length > 0 ? <ul>{item.options.map((option, i) => <li key={i} className={option === item.correctAnswer ? 'is-answer' : ''}>{option}</li>)}</ul> : <p className="open-question">Pregunta abierta</p>}
        <details><summary>Ver respuesta</summary><p><b>{item.correctAnswer}.</b> {item.explanation}</p></details>
      </li>)}</ol></section>}

    {!!workshop.teacherNotes?.length && <section className="w-section teacher-notes"><h3><NotebookPen size={16} aria-hidden />Solo para ti</h3>
      <ul>{workshop.teacherNotes.map((note, i) => <li key={i}>{note}</li>)}</ul>
      <small>No aparece en el archivo para estudiantes; sí en la clave docente.</small></section>}

    <footer className="workshop-foot"><FileText size={14} aria-hidden />Fuente: {workshop.sourceReferences.join(' · ') || 'no especificada'}. Revísalo antes de compartirlo; el archivo para estudiantes no incluye respuestas. Puedes editar el título y el resumen haciendo clic sobre ellos.</footer>
  </article>
}
