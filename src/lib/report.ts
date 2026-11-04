import type { Course, GeneratedWorkshop } from '../api'
import { formatGrade, levelLabel, plural, todayLabel, type CourseSummary, type SubjectInsight } from './domain'
import type { Projection, Trend } from './insights'

export function mailtoLink(email: string | null | undefined, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Opens the browser's print dialog with a one-page course report the teacher can save as PDF. */
export function printCourseReport({ course, teacher, summary, insights, trends, projections, workshops }: { course: Course; teacher: string; summary: CourseSummary; insights: SubjectInsight[]; trends: Trend[]; projections: Map<number, Projection>; workshops: GeneratedWorkshop[] }) {
  const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c)
  const pct = (n: number) => summary.graded ? Math.round(n / summary.graded * 100) : 0
  const down = trends.filter(t => t.direction === 'down')
  const priority = trends.filter(t => t.student.hasGrades && t.risk >= 50).slice(0, 12)
  const rows = trends.map(t => {
    const p = projections.get(t.student.id)
    return `<tr><td>${esc(t.student.name)}</td><td class="n">${t.student.hasGrades ? formatGrade(t.student.average) : '—'}</td><td>${t.student.hasGrades ? levelLabel[t.student.level] : 'Sin notas'}</td><td>${t.direction === 'down' ? '↓ baja' : t.direction === 'up' ? '↑ sube' : t.direction === 'flat' ? '= estable' : '—'}</td><td>${p ? esc(p.explanation) : '—'}</td></tr>`
  }).join('')
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe · ${esc(course.name)}</title><style>
@page{size:A4;margin:16mm}body{font-family:"Instrument Sans",Arial,sans-serif;color:#14232a;font-size:12px;line-height:1.5;margin:0}
h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:30px;margin:4px 0}h2{font-size:14px;margin:22px 0 8px}
.brand{color:#136f86;font-weight:600;font-size:12px}.meta{color:#5f6d73}.kpis{display:flex;gap:0;border:1px solid #e4e7e2;border-radius:10px;margin-top:16px}
.kpis div{flex:1;padding:10px 14px}.kpis div+div{border-left:1px solid #e4e7e2}.kpis b{display:block;font-size:22px;font-weight:400}.kpis span{color:#5f6d73}
.bar{display:flex;height:12px;border-radius:6px;overflow:hidden;margin:8px 0}.bar i{display:block}
table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #eef0ec;text-align:left;vertical-align:top}th{color:#5f6d73;font-weight:500}.n{text-align:right;font-variant-numeric:tabular-nums}
ul{margin:0;padding-left:18px}.note{color:#5f6d73;font-size:11px;margin-top:20px}</style>
<div class="brand">FairTeam · Informe del curso</div><h1>${esc(course.name)}</h1><div class="meta">${esc(course.period || '')} · ${esc(teacher)} · ${todayLabel()}</div>
<div class="kpis"><div><b>${summary.students}</b><span>estudiantes</span></div><div><b>${summary.average == null ? '—' : formatGrade(summary.average)}</b><span>promedio / 5</span></div><div><b>${summary.low}</b><span>en refuerzo (${pct(summary.low)}%)</span></div><div><b>${down.length}</b><span>vienen bajando</span></div></div>
<h2>Distribución</h2><div class="bar"><i style="flex:${summary.low};background:#d0644d"></i><i style="flex:${summary.medium};background:#d8a237"></i><i style="flex:${summary.high};background:#3f9a6e"></i></div>
<div class="meta">Refuerzo ${summary.low} · Seguimiento ${summary.medium} · Buen progreso ${summary.high}${summary.ungraded ? ` · Sin notas ${summary.ungraded}` : ''}</div>
${insights.length ? `<h2>Promedio por tema</h2><table><tr><th>Tema</th><th class="n">Promedio</th><th class="n">Bajo 3,0</th></tr>${insights.map(i => `<tr><td>${esc(i.name)}</td><td class="n">${formatGrade(i.average)}</td><td class="n">${i.lowCount}</td></tr>`).join('')}</table>` : ''}
<h2>Recomendaciones</h2><ul>
${summary.low ? `<li>Programar refuerzo para ${plural(summary.low, 'estudiante', 'estudiantes')}${insights[0] ? `, empezando por ${esc(insights[0].name)}` : ''}.</li>` : '<li>No hay estudiantes por debajo de 3,0.</li>'}
${down.length ? `<li>Hacer seguimiento cercano a quienes bajaron: ${down.slice(0, 6).map(t => esc(t.student.name)).join(', ')}${down.length > 6 ? '…' : ''}.</li>` : ''}
${summary.ungraded ? `<li>Completar las notas de ${plural(summary.ungraded, 'estudiante', 'estudiantes')}.</li>` : ''}
${workshops.length ? `<li>${plural(workshops.length, 'taller o quiz preparado', 'talleres y quizzes preparados')} en FairTeam para este curso.</li>` : ''}</ul>
${priority.length ? `<h2>Prioridad de acompañamiento</h2><ul>${priority.map(t => `<li><b>${esc(t.student.name)}</b>: ${formatGrade(t.student.average)}${t.weakest ? `, le cuesta ${esc(t.weakest.name)}` : ''}.</li>`).join('')}</ul>` : ''}
<h2>Detalle por estudiante</h2><table><tr><th>Estudiante</th><th class="n">Promedio</th><th>Estado</th><th>Tendencia</th><th>Proyección</th></tr>${rows}</table>
<p class="note">Generado con FairTeam a partir de las notas cargadas. Las clasificaciones orientan al docente y no reemplazan su criterio.</p></html>`
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) { frame.remove(); return }
  doc.open(); doc.write(html); doc.close()
  window.setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 2000) }, 250)
}
