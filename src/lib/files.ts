import { splitFences } from '../components/RichText'
import type { GeneratedWorkshop } from '../api'
import { formatGrade, levelLabel, levelOf, type Candidate } from './domain'

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, contents: string, type: string) {
  downloadBlob(filename, new Blob([contents], { type }))
}

export async function downloadTemplate(kind: 'roster' | 'grades', format: 'xlsx' | 'csv') {
  const base = kind === 'roster' ? 'plantilla-estudiantes-fairteam' : 'plantilla-notas-fairteam'
  if (format === 'csv') {
    const header = kind === 'roster' ? 'name,email,academicLevel' : 'studentName,studentEmail,subject,grade,period'
    return downloadText(`${base}.csv`, `﻿${header}\r\n`, 'text/csv;charset=utf-8')
  }
  const templates = await import('./templates')
  await (kind === 'roster' ? templates.downloadRosterTemplate() : templates.downloadGradesTemplate())
}

export function learningReportCsv(students: Candidate[]) {
  const columns = ['Estudiante', 'Correo', 'Promedio', 'Cantidad de notas', 'Estado', 'Observación']
  const rows = students.map(student => {
    const status = !student.hasGrades ? 'Sin notas' : levelLabel[student.level]
    const reason = !student.hasGrades ? 'No tiene notas cargadas' : student.level === 'LOW' ? `Promedio menor a ${formatGrade(3)} en ${student.gradeCount} nota(s)` : student.level === 'MEDIUM' ? `Promedio entre 3,0 y menos de 4,0 en ${student.gradeCount} nota(s)` : `Promedio de 4,0 o más en ${student.gradeCount} nota(s)`
    return [student.name, student.email || '', student.hasGrades ? formatGrade(student.average) : '', String(student.gradeCount), status, reason]
  })
  return toCsv([columns, ...rows])
}

/** Semicolon-separated, quoted, with a BOM so Excel in Spanish opens accents and columns correctly. */
export function toCsv(rows: string[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')
}

export function downloadLearningReport(students: Candidate[], courseName: string) {
  const slug = slugify(courseName) || 'curso'
  downloadText(`seguimiento-${slug}-${new Date().toISOString().slice(0, 10)}.csv`, learningReportCsv(students), 'text/csv;charset=utf-8')
}

export function slugify(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

export function workshopAsText(workshop: GeneratedWorkshop) {
  return [
    workshop.title,
    workshop.summary,
    '',
    'OBJETIVOS',
    ...workshop.learningObjectives.map(item => `• ${item}`),
    '',
    'ACTIVIDADES',
    ...(workshop.studentIntro ? ['ANTES DE EMPEZAR', workshop.studentIntro, ''] : []),
    ...workshop.activities.map((item, index) => [`${index + 1}. ${item.title} (${item.estimatedMinutes} min)`, item.goal, item.instructions,
      item.hints?.length ? `Pistas:\n${item.hints.map(hint => `   - ${hint}`).join('\n')}` : '', item.deliverable ? `Entrega: ${item.deliverable}` : '', ''].filter(Boolean).join('\n') + '\n'),
    'EVALUACIÓN',
    ...workshop.assessment.map((item, index) => `${index + 1}. ${item.question}\n${item.options.map(option => `   - ${option}`).join('\n')}\n   Respuesta: ${item.correctAnswer}. ${item.explanation}\n`),
    ...(workshop.teacherNotes?.length ? ['NOTAS PARA EL DOCENTE', ...workshop.teacherNotes.map(note => `• ${note}`), ''] : []),
    `Material consultado: ${workshop.sourceReferences.join(', ') || 'no especificado'}`,
  ].join('\n')
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)

/** Text from the AI as HTML: paragraphs keep their line breaks and ``` blocks become code. */
function richHtml(text: string) {
  return splitFences(text).map(part => part.kind === 'code'
    ? `<pre><code>${escapeHtml(part.value)}</code></pre>`
    : `<p>${escapeHtml(part.value)}</p>`).join('')
}

/** A standalone, printable HTML sheet. Students' copy never includes the answer key nor the teacher's notes. */
export function workshopHtml(workshop: GeneratedWorkshop, includeAnswerKey = false) {
  const escape = escapeHtml
  const isQuiz = workshop.supportType === 'quiz'
  const objectives = workshop.learningObjectives.map(item => `<li>${escape(item)}</li>`).join('')
  const activities = workshop.activities.map((item, index) => `<article><h3><span>${index + 1}</span>${escape(item.title)}<small>${item.estimatedMinutes} min</small></h3>
${item.goal ? `<p class="goal">${escape(item.goal)}</p>` : ''}<div class="body">${richHtml(item.instructions)}</div>
${item.hints?.length ? `<details class="hints"${includeAnswerKey ? ' open' : ''}><summary>Pistas si te atascas</summary><ol>${item.hints.map(hint => `<li>${escape(hint)}</li>`).join('')}</ol></details>` : ''}
${item.deliverable ? `<p class="deliverable"><b>Entrega:</b> ${escape(item.deliverable)}</p>` : ''}</article>`).join('')
  const questions = workshop.assessment.map((item, index) => `<article class="question"><h3><span>${index + 1}</span>${escape(item.question)}</h3>${item.options.length ? `<ol type="a">${item.options.map(option => `<li>${escape(option)}</li>`).join('')}</ol>` : ''}${includeAnswerKey ? `<div class="key"><b>Respuesta:</b> ${escape(item.correctAnswer)}. ${escape(item.explanation)}</div>` : `<div class="answer-line">${item.options.length ? 'Respuesta: ______________________' : 'Respuesta:<br><br><br>'}</div>`}</article>`).join('')
  const notes = includeAnswerKey && workshop.teacherNotes?.length ? `<section class="notes"><h2>Notas para el docente</h2><ul>${workshop.teacherNotes.map(note => `<li>${escape(note)}</li>`).join('')}</ul></section>` : ''
  const sources = workshop.sourceReferences.map(escape).join(' · ') || 'No especificado'
  const kind = isQuiz ? 'Quiz' : 'Taller'
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(workshop.title)}</title><style>
:root{font-family:"Instrument Sans",Inter,Arial,sans-serif;color:#15232b;background:#f4f5f2}body{margin:0;padding:32px 16px}
.sheet{max-width:780px;margin:auto;padding:48px 52px;background:#fff;border:1px solid #e4e7e6;border-radius:14px}
.brand{color:#17708a;font-size:13px;font-weight:600}h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:36px;line-height:1.1;margin:14px 0 8px}
.meta{color:#55636b;font-size:14px}.fields{display:flex;gap:24px;margin:22px 0;font-size:14px;color:#55636b}.fields span{flex:1;border-bottom:1px solid #cfd5d4;padding-bottom:4px}
.summary{padding:14px 16px;background:#f2f7f8;border-radius:10px;line-height:1.6;margin:20px 0}h2{font-size:16px;margin:28px 0 10px}
.intro{padding:14px 16px;border-left:3px solid #17708a;background:#fbfcfb;line-height:1.65}
li,p{line-height:1.6}article{padding:16px 0;border-top:1px solid #eef0ef;break-inside:avoid}h3{display:flex;gap:10px;align-items:baseline;font-size:15px;margin:0 0 6px}
h3 span{color:#17708a;font-variant-numeric:tabular-nums}h3 small{margin-left:auto;color:#55636b;font-weight:500}.body,.goal,.deliverable,.hints{margin-left:22px}
.body p{margin:4px 0;white-space:pre-line}.goal{margin-top:0;color:#55636b;font-style:italic}
pre{margin:8px 0;padding:12px 14px;border-radius:8px;background:#15232b;color:#eef3f2;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap}
.hints{margin-top:8px;font-size:14px;color:#3b4a52}.hints summary{cursor:pointer;font-weight:600;color:#17708a}.deliverable{margin-top:8px;padding:8px 12px;border-radius:8px;background:#f2f7f8;font-size:14px}
ol{margin:6px 0 0 22px}.key{margin:10px 0 0 22px;padding:10px 12px;border-radius:8px;background:#f4f5f2;font-size:14px}.answer-line{margin:12px 0 0 22px;color:#55636b;font-size:14px}
.notes{margin-top:28px;padding:14px 18px;border-radius:10px;background:#fbf1da}.notes h2{margin-top:0}
footer{margin-top:28px;padding-top:12px;border-top:1px solid #e4e7e6;color:#55636b;font-size:12px}
@media print{body{padding:0;background:#fff}.sheet{border:0;padding:16mm;max-width:none}.hints{display:block}}
</style><body><main class="sheet"><div class="brand">FairTeam · ${kind}${includeAnswerKey ? ' · Clave docente' : ''}</div><h1>${escape(workshop.title)}</h1>
<div class="meta">${escape(workshop.subject)} · ${escape(levelLabel[levelOf(workshop.targetLevel)])}</div>
${includeAnswerKey ? '' : '<div class="fields"><span>Nombre:</span><span>Fecha:</span></div>'}
<p class="summary">${escape(workshop.summary)}</p>
${workshop.studentIntro ? `<h2>Antes de empezar</h2><div class="intro">${richHtml(workshop.studentIntro)}</div>` : ''}
<h2>Lo que vas a aprender</h2><ul>${objectives}</ul>
${activities && !isQuiz ? `<h2>Actividades</h2>${activities}` : ''}${questions ? `<h2>${isQuiz ? 'Preguntas' : 'Comprueba lo aprendido'}</h2>${questions}` : ''}
${notes}<footer>Material consultado: ${sources}</footer></main></body></html>`
}

export function downloadWorkshopDocument(workshop: GeneratedWorkshop, includeAnswerKey = false) {
  const name = slugify(workshop.title) || 'actividad-fairteam'
  downloadText(`${name}${includeAnswerKey ? '-clave-docente' : ''}.html`, workshopHtml(workshop, includeAnswerKey), 'text/html;charset=utf-8')
}

export function printWorkshop(workshop: GeneratedWorkshop) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) { frame.remove(); return }
  doc.open()
  doc.write(workshopHtml(workshop))
  doc.close()
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  window.setTimeout(() => frame.remove(), 1500)
}

/** The course roster with each student's current average, ready for Excel. */
export function rosterCsv(students: Candidate[]) {
  return toCsv([['Nombre', 'Correo', 'Promedio', 'Notas', 'Estado'], ...students.map(s => [s.name, s.email || '', s.hasGrades ? formatGrade(s.average) : '', String(s.gradeCount), s.hasGrades ? levelLabel[s.level] : 'Sin notas'])])
}

export function downloadRoster(students: Candidate[], courseName: string) {
  downloadText(`lista-${slugify(courseName) || 'curso'}.csv`, rosterCsv(students), 'text/csv;charset=utf-8')
}
