import type { AcademicLevel, Course, CourseMaterial, GeneratedWorkshop } from '../api'
import type { Route } from '../app/router'
import type { SupportMode } from '../app/types'
import { firstName, formatGrade, greetingFor, levelLabel, plural, round1, type Candidate, type CourseSummary, type Subject, type SubjectInsight } from './domain'
import { projectionText, type Projection, type Trend } from './insights'

export type BuhoAction =
  | { kind: 'navigate'; label: string; route: Route; params?: Record<string, string> }
  | { kind: 'workshop'; label: string; mode: SupportMode; level: AcademicLevel; topic?: string; student?: Candidate }
  | { kind: 'review'; label: string; student: Candidate }
  | { kind: 'message'; label: string; student: Candidate }
  | { kind: 'report'; label: string }
  | { kind: 'briefing'; label: string }
  | { kind: 'course'; label: string; courseId: number }

export type BuhoItem = { student: Candidate; value: string; note: string; tone: 'low' | 'medium' | 'high' | 'none' }
export type BuhoReply = { text: string; items?: BuhoItem[]; actions?: BuhoAction[]; run?: BuhoAction }

export type BuhoContext = {
  teacher: string
  course: Course | null
  courses: Course[]
  candidates: Candidate[]
  summary: CourseSummary
  insights: SubjectInsight[]
  subjects: Subject[]
  trends: Trend[]
  projections: Map<number, Projection>
  materials: CourseMaterial[] | null
  workshops: GeneratedWorkshop[]
}

export const examples = [
  '¿Cómo va el curso?',
  '¿Quién necesita refuerzo en Funciones?',
  '¿Quién viene bajando?',
  '¿Qué nota necesita Valentina para pasar?',
  'Crea un quiz de ciclos para refuerzo',
  'Escríbele un mensaje a Santiago',
  'Genera el informe del curso',
]

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()
const has = (text: string, ...words: string[]) => words.some(w => new RegExp(`(^| )${w}`).test(text))
const stop = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'a', 'para', 'con', 'que', 'por', 'un', 'una', 'mi', 'al'])

function findStudent(text: string, candidates: Candidate[]): Candidate | null {
  const words = text.split(' ').filter(w => w.length >= 3 && !stop.has(w))
  let best: { c: Candidate; score: number } | null = null
  for (const c of candidates) {
    const parts = norm(c.name).split(' ').filter(p => p.length >= 2 && !stop.has(p))
    let score = 0
    parts.forEach((p, i) => { if (words.includes(p)) score += i === 0 ? 3 : 2 })
    if (score && (!best || score > best.score)) best = { c, score }
  }
  return best?.c ?? null
}

function findSubject(text: string, ctx: BuhoContext): SubjectInsight | null {
  const pool = ctx.insights.length ? ctx.insights : ctx.subjects.map(s => ({ id: s.id, name: s.name, average: NaN, count: 0, lowCount: 0 }))
  let best: { s: SubjectInsight; score: number } | null = null
  for (const s of pool) {
    const parts = norm(s.name).split(' ').filter(p => p.length >= 4 && !stop.has(p))
    const score = parts.filter(p => text.includes(p) || text.includes(p.slice(0, Math.max(4, p.length - 2)))).length
    if (score && (!best || score > best.score)) best = { s, score }
  }
  return best?.s ?? null
}

function findLevel(text: string): AcademicLevel | null {
  if (has(text, 'refuerzo', 'bajo', 'mal', 'reprob', 'perdiendo', 'dificultad')) return 'LOW'
  if (has(text, 'seguimiento', 'medio', 'intermedio')) return 'MEDIUM'
  if (has(text, 'reto', 'avanzad', 'alto', 'destacad', 'profundiz')) return 'HIGH'
  return null
}

const toneOf = (c: Candidate): BuhoItem['tone'] => !c.hasGrades ? 'none' : c.level === 'LOW' ? 'low' : c.level === 'MEDIUM' ? 'medium' : 'high'

/** The spoken daily briefing: what is happening and what to do first. */
export function briefing(ctx: BuhoContext): string {
  const { course, summary, insights, trends, teacher, materials } = ctx
  const hello = `${greetingFor()}, ${firstName(teacher)}.`
  if (!course) return `${hello} Todavía no tienes cursos. Empecemos creando el primero.`
  if (!summary.students) return `${hello} ${course.name} está listo, pero falta la lista de estudiantes. Importa el Excel del grupo y te digo cómo va cada uno.`
  if (!summary.gradeCount) return `${hello} En ${course.name} tienes ${plural(summary.students, 'estudiante', 'estudiantes')}, pero aún no hay notas. Cuando las cargues te digo quién necesita apoyo.`
  const down = trends.filter(t => t.direction === 'down')
  const top = trends.filter(t => t.student.hasGrades && t.student.level === 'LOW').slice(0, 2).map(t => firstName(t.student.name))
  const parts = [
    hello,
    `En ${course.name} el promedio va en ${formatGrade(summary.average!)}.`,
    summary.low ? `${plural(summary.low, 'estudiante necesita', 'estudiantes necesitan')} refuerzo${top.length ? `; empieza por ${top.join(' y ')}` : ''}.` : 'Nadie está por debajo de tres.',
    insights[0] && insights[0].average < 3.5 ? `El tema que más cuesta es ${insights[0].name}, con ${formatGrade(insights[0].average)}.` : '',
    down.length ? `Ojo: ${plural(down.length, 'estudiante viene', 'estudiantes vienen')} bajando desde el primer corte.` : '',
    summary.low && materials && !materials.length ? 'Sube el material del tema y te preparo el taller de refuerzo.' : summary.low ? 'Si quieres, te preparo ya un taller de refuerzo.' : 'Buen momento para proponer un reto a los que van mejor.',
  ]
  return parts.filter(Boolean).join(' ')
}

export function interpret(input: string, ctx: BuhoContext): BuhoReply {
  const text = norm(input)
  const { course, candidates, summary, insights, trends, projections } = ctx
  if (!text) return { text: '¿En qué te ayudo?' }

  // Switch course: "cambia a Estructuras de datos"
  if (has(text, 'cambia', 'abre el curso', 'curso de', 'ir al curso')) {
    const target = ctx.courses.find(c => norm(c.name).split(' ').filter(w => w.length > 3).some(w => text.includes(w)))
    if (target && target.id !== course?.id) return { text: `Listo, abrí ${target.name}.`, run: { kind: 'course', label: target.name, courseId: target.id } }
  }

  if (has(text, 'ayuda', 'que puedes', 'que sabes', 'comandos', 'como funcionas')) {
    return { text: 'Puedo decirte cómo va el curso, quién necesita apoyo y quién viene bajando, calcular qué nota necesita alguien para pasar, crear talleres y quizzes, redactar mensajes a tus estudiantes y generar el informe del curso. Pregúntame como le preguntarías a un colega.' }
  }
  if (!course) return { text: 'Primero necesitas un curso. ¿Lo creamos?', actions: [{ kind: 'navigate', label: 'Crear curso', route: 'cursos', params: { nuevo: '1' } }] }

  if (has(text, 'resumen', 'como va el curso', 'como vamos', 'como va todo', 'que hago hoy', 'que hay hoy', 'buenos dias', 'buenas tardes', 'buenas noches', 'novedades', 'informame', 'ponme al dia')) {
    return { text: briefing(ctx), actions: summary.low ? [{ kind: 'workshop', label: 'Preparar refuerzo', mode: 'workshop', level: 'LOW', topic: insights[0]?.name }, { kind: 'navigate', label: 'Ver seguimiento', route: 'seguimiento' }] : [{ kind: 'navigate', label: 'Ver seguimiento', route: 'seguimiento' }] }
  }

  const student = findStudent(text, candidates)
  const subject = findSubject(text, ctx)
  const level = findLevel(text)

  // Create a workshop or a quiz
  if (has(text, 'crea', 'genera', 'prepara', 'haz', 'hazme', 'arma', 'diseña', 'disena', 'quiero un', 'necesito un') && has(text, 'taller', 'quiz', 'evaluacion', 'actividad', 'examen', 'prueba', 'guia', 'refuerzo')) {
    const mode: SupportMode = has(text, 'quiz', 'evaluacion', 'examen', 'prueba') ? 'quiz' : 'workshop'
    const lvl = student?.level ?? level ?? (summary.low ? 'LOW' : 'MEDIUM')
    const topic = subject?.name ?? (text.match(/(?:de|sobre) ([a-z0-9ñ ]{3,40})$/)?.[1]?.replace(/ para .*$/, '').trim() || undefined)
    const what = mode === 'quiz' ? 'un quiz de tres preguntas' : 'un taller de práctica'
    const who = student ? ` para ${firstName(student.name)}` : lvl === 'LOW' ? ' de refuerzo' : lvl === 'MEDIUM' ? ' para los que están en seguimiento' : ' de reto'
    if (ctx.materials && !ctx.materials.length) return { text: `Para crear ${what} necesito el material de clase. Súbelo en Talleres y lo preparo.`, run: { kind: 'workshop', label: 'Abrir talleres', mode, level: lvl, topic, student: student ?? undefined } }
    return { text: `Voy a preparar ${what}${topic ? ` sobre ${topic}` : ''}${who}. Revisa el material seleccionado y presiona crear.`, run: { kind: 'workshop', label: 'Abrir talleres', mode, level: lvl, topic, student: student ?? undefined } }
  }

  // Draft a message
  if (has(text, 'mensaje', 'retroalimentacion', 'correo', 'escribele', 'escribe', 'redacta', 'felicita', 'feedback')) {
    if (!student) return { text: '¿A quién le escribo? Dime el nombre del estudiante.' }
    return { text: `Te dejé listo un mensaje para ${firstName(student.name)}. Revísalo antes de enviarlo.`, run: { kind: 'message', label: 'Ver mensaje', student } }
  }

  if (has(text, 'informe', 'reporte', 'pdf', 'imprimir')) {
    return { text: `Generé el informe de ${course.name}. Se abrirá para imprimir o guardar como PDF.`, run: { kind: 'report', label: 'Generar informe' } }
  }

  if (!summary.gradeCount && !has(text, 'equipo', 'importa', 'sube', 'material', 'abre', 'ir a', 'llevame')) {
    return { text: `Aún no hay notas en ${course.name}. Cárgalas y podré responderte eso.`, actions: [{ kind: 'navigate', label: 'Ir a estudiantes y notas', route: 'estudiantes' }] }
  }

  // What does someone need to pass?
  if (has(text, 'que nota', 'cuanto debe', 'cuanto necesita', 'cuanto le falta', 'necesita para', 'necesita sacar', 'para pasar', 'para aprobar', 'alcanza', 'pierde', 'perder', 'aprueba', 'gana el')) {
    if (student) {
      const p = projections.get(student.id)
      return { text: `${student.name}: ${p ? projectionText(p) : 'no tengo suficientes notas.'}`, actions: [{ kind: 'review', label: `Ver ficha de ${firstName(student.name)}`, student }, { kind: 'navigate', label: 'Abrir simulador', route: 'seguimiento', params: { vista: 'simulador' } }] }
    }
    const atRisk = [...projections.values()].filter(p => p.status === 'hard' || p.status === 'impossible').sort((a, b) => (b.needed ?? 9) - (a.needed ?? 9))
    if (!atRisk.length) return { text: 'Con las notas actuales, todos pueden llegar a 3,0 sin necesitar más de 3,5 en lo que falta.', actions: [{ kind: 'navigate', label: 'Abrir simulador', route: 'seguimiento', params: { vista: 'simulador' } }] }
    return { text: `${plural(atRisk.length, 'estudiante está', 'estudiantes están')} en riesgo de perder: necesitan más de 3,5 en lo que falta.`, items: atRisk.slice(0, 6).map(p => ({ student: p.student, value: p.needed == null ? '—' : formatGrade(p.needed), note: projectionText(p), tone: 'low' as const })), actions: [{ kind: 'navigate', label: 'Abrir simulador', route: 'seguimiento', params: { vista: 'simulador' } }] }
  }

  // Trends
  if (has(text, 'bajando', 'bajado', 'empeor', 'cayendo', 'riesgo', 'preocup', 'alerta')) {
    const down = trends.filter(t => t.direction === 'down')
    if (!down.length) return { text: trends.some(t => t.points.length >= 2) ? 'Buenas noticias: nadie ha bajado más de 0,3 entre cortes.' : 'Necesito notas de al menos dos cortes para ver tendencias.', actions: [{ kind: 'navigate', label: 'Ver tendencias', route: 'seguimiento', params: { vista: 'tendencia' } }] }
    return { text: `${plural(down.length, 'estudiante viene', 'estudiantes vienen')} bajando. ${firstName(down[0].student.name)} es quien más bajó.`, items: down.slice(0, 6).map(t => ({ student: t.student, value: `${formatGrade(t.delta!)}`, note: `${t.points.map(p => formatGrade(p.average)).join(' → ')}`, tone: 'low' as const })), actions: [{ kind: 'navigate', label: 'Ver tendencias', route: 'seguimiento', params: { vista: 'tendencia' } }] }
  }
  if (has(text, 'subiendo', 'mejorando', 'mejoro', 'mejorado', 'progreso')) {
    const up = trends.filter(t => t.direction === 'up')
    return up.length ? { text: `${plural(up.length, 'estudiante viene', 'estudiantes vienen')} mejorando. Vale la pena reconocérselo.`, items: up.slice(0, 6).map(t => ({ student: t.student, value: `+${formatGrade(t.delta!)}`, note: t.points.map(p => formatGrade(p.average)).join(' → '), tone: 'high' as const })) } : { text: 'Por ahora nadie ha subido más de 0,3 entre cortes.' }
  }

  // Best students
  if (has(text, 'mejor', 'mejores', 'destacad', 'top', 'quien va bien', 'quienes van bien')) {
    const best = candidates.filter(c => c.hasGrades).sort((a, b) => b.average - a.average).slice(0, 5)
    return { text: `${firstName(best[0].name)} lleva el mejor promedio con ${formatGrade(best[0].average)}.`, items: best.map(c => ({ student: c, value: formatGrade(c.average), note: levelLabel[c.level], tone: toneOf(c) })), actions: [{ kind: 'workshop', label: 'Crear un reto', mode: 'workshop', level: 'HIGH' }] }
  }

  // A specific student
  if (student && !has(text, 'quienes', 'cuantos')) {
    const t = trends.find(x => x.student.id === student.id)
    const p = projections.get(student.id)
    const bits = student.hasGrades ? [
      `${student.name} tiene ${formatGrade(student.average)} de promedio en ${plural(student.gradeCount, 'nota', 'notas')}: ${levelLabel[student.level].toLowerCase()}.`,
      t?.direction === 'down' ? `Viene bajando (${t.points.map(x => formatGrade(x.average)).join(' → ')}).` : t?.direction === 'up' ? 'Viene mejorando.' : '',
      t?.weakest ? `Su tema más difícil es ${t.weakest.name}, con ${formatGrade(t.weakest.average)}.` : '',
      p && p.status !== 'passed' && p.status !== 'no-data' ? projectionText(p) : '',
    ] : [`${student.name} todavía no tiene notas.`]
    return { text: bits.filter(Boolean).join(' '), actions: [{ kind: 'review', label: 'Ver ficha', student }, { kind: 'workshop', label: 'Taller para este estudiante', mode: 'workshop', level: student.level, student, topic: t?.weakest?.name }, { kind: 'message', label: 'Escribirle', student }] }
  }

  // Averages
  if (has(text, 'promedio', 'media', 'nota del curso', 'como van')) {
    if (subject && Number.isFinite(subject.average)) return { text: `En ${subject.name} el promedio es ${formatGrade(subject.average)}${subject.lowCount ? ` y ${plural(subject.lowCount, 'estudiante está', 'estudiantes están')} por debajo de 3,0` : ''}.`, actions: [{ kind: 'workshop', label: `Taller de ${subject.name}`, mode: 'workshop', level: 'LOW', topic: subject.name }] }
    return { text: `El promedio de ${course.name} es ${formatGrade(summary.average!)} con ${plural(summary.gradeCount, 'nota', 'notas')}. ${insights[0] ? `El tema más bajo es ${insights[0].name} (${formatGrade(insights[0].average)}) y el más alto ${insights[insights.length - 1].name} (${formatGrade(insights[insights.length - 1].average)}).` : ''}` }
  }

  // Who needs help (optionally in a subject)
  if (has(text, 'quien', 'quienes', 'cuales', 'cuantos', 'lista') || level || subject) {
    if (subject && !Number.isNaN(subject.average)) {
      const struggling = trends.map(t => ({ t, avg: t.bySubject.find(x => x.name === subject.name)?.average })).filter((x): x is { t: Trend; avg: number } => x.avg != null && round1(x.avg) < 3).sort((a, b) => a.avg - b.avg)
      return { text: struggling.length ? `En ${subject.name}, ${plural(struggling.length, 'estudiante está', 'estudiantes están')} por debajo de 3,0. Promedio del tema: ${formatGrade(subject.average)}.` : `En ${subject.name} nadie está por debajo de 3,0. Promedio del tema: ${formatGrade(subject.average)}.`, items: struggling.slice(0, 8).map(({ t, avg }) => ({ student: t.student, value: formatGrade(avg), note: `promedio general ${formatGrade(t.student.average)}`, tone: 'low' as const })), actions: struggling.length ? [{ kind: 'workshop', label: `Taller de ${subject.name}`, mode: 'workshop', level: 'LOW', topic: subject.name }] : [] }
    }
    const lvl = level ?? 'LOW'
    const list = candidates.filter(c => c.hasGrades && c.level === lvl).sort((a, b) => a.average - b.average)
    const label = lvl === 'LOW' ? 'necesitan refuerzo' : lvl === 'MEDIUM' ? 'están en seguimiento' : 'van con buen progreso'
    if (!list.length) return { text: `Nadie ${lvl === 'LOW' ? 'necesita refuerzo' : lvl === 'MEDIUM' ? 'está en seguimiento' : 'tiene 4,0 o más'} en este momento.` }
    const one = lvl === 'LOW' ? 'necesita refuerzo' : lvl === 'MEDIUM' ? 'está en seguimiento' : 'va con buen progreso'
    return { text: list.length === 1 ? `Solo ${list[0].name} ${one}.` : `${list.length} estudiantes ${label}.`, items: list.slice(0, 8).map(c => ({ student: c, value: formatGrade(c.average), note: `${plural(c.gradeCount, 'nota', 'notas')}`, tone: toneOf(c) })), actions: lvl === 'LOW' ? [{ kind: 'workshop', label: 'Preparar refuerzo', mode: 'workshop', level: 'LOW', topic: insights[0]?.name }] : [] }
  }

  // Navigation and imports
  if (has(text, 'equipo', 'grupos de trabajo')) return { text: 'Abro el armador de equipos.', run: { kind: 'navigate', label: 'Equipos', route: 'equipos' } }
  if (has(text, 'importa', 'subir notas', 'cargar notas', 'sube las notas', 'subir la lista', 'cargar la lista', 'estudiantes')) return { text: 'Abro Estudiantes y notas para que importes el Excel.', run: { kind: 'navigate', label: 'Estudiantes y notas', route: 'estudiantes' } }
  if (has(text, 'material', 'pdf', 'archivo')) return { text: 'Abro Talleres: ahí puedes subir el material del curso.', run: { kind: 'navigate', label: 'Talleres', route: 'talleres' } }
  if (has(text, 'seguimiento', 'alertas')) return { text: 'Abro el seguimiento.', run: { kind: 'navigate', label: 'Seguimiento', route: 'seguimiento' } }
  if (has(text, 'simulador', 'proyeccion')) return { text: 'Abro el simulador de notas.', run: { kind: 'navigate', label: 'Simulador', route: 'seguimiento', params: { vista: 'simulador' } } }
  if (has(text, 'ajustes', 'configuracion')) return { text: 'Abro los ajustes.', run: { kind: 'navigate', label: 'Ajustes', route: 'ajustes' } }
  if (has(text, 'inicio', 'principal')) return { text: 'Volvemos al inicio.', run: { kind: 'navigate', label: 'Inicio', route: 'inicio' } }

  return { text: 'No estoy seguro de haberte entendido. Prueba con algo como: “¿quién viene bajando?” o “crea un quiz de funciones”.' }
}
