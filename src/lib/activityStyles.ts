/** Kinds of work a workshop can ask for. Ids match the AI service (activityStyles). */
export type ActivityStyleId = 'GUIDED' | 'PROBLEMS' | 'LAB' | 'SOURCES' | 'ESSAY' | 'READING' | 'WRITING' | 'ORAL' | 'CODE' | 'APP' | 'DEPLOY' | 'CASE' | 'TEAM'

export interface ActivityStyle { id: ActivityStyleId; label: string; detail: string; extended: boolean }

export const ACTIVITY_STYLES: ActivityStyle[] = [
  { id: 'GUIDED', label: 'Ejercicios guiados', detail: 'Práctica paso a paso para una clase.', extended: false },
  { id: 'PROBLEMS', label: 'Resolución de problemas', detail: 'Problemas con datos, uno resuelto como modelo.', extended: false },
  { id: 'LAB', label: 'Laboratorio o experimento', detail: 'Hipótesis, procedimiento, datos y conclusión.', extended: true },
  { id: 'SOURCES', label: 'Análisis de fuentes', detail: 'Contexto, propósito y contraste de fuentes.', extended: false },
  { id: 'ESSAY', label: 'Ensayo o debate', detail: 'Tesis, argumentos, contraargumento.', extended: true },
  { id: 'READING', label: 'Comprensión de lectura', detail: 'Texto breve con preguntas literales e inferenciales.', extended: false },
  { id: 'WRITING', label: 'Producción escrita', detail: 'Propósito, modelo y lista de verificación.', extended: false },
  { id: 'ORAL', label: 'Expresión oral', detail: 'Presentación o diálogo con frases útiles.', extended: false },
  { id: 'CODE', label: 'Programar código', detail: 'Esqueleto inicial, casos de prueba y repositorio.', extended: true },
  { id: 'APP', label: 'Construir una app', detail: 'Historias de usuario y criterios de aceptación.', extended: true },
  { id: 'DEPLOY', label: 'Desplegar en internet', detail: 'Publicarla y entregar la URL funcionando.', extended: true },
  { id: 'CASE', label: 'Caso de estudio', detail: 'Un escenario real para decidir y justificar.', extended: false },
  { id: 'TEAM', label: 'Proyecto en equipo', detail: 'Roles, entregas por persona y punto de control.', extended: true },
]

export const MAX_STYLES = 3

/** Toggles a style keeping at most three; choosing anything else drops the default "guided" choice. */
export function toggleStyle(current: ActivityStyleId[], id: ActivityStyleId): ActivityStyleId[] {
  if (current.includes(id)) {
    const rest = current.filter(style => style !== id)
    return rest.length ? rest : ['GUIDED']
  }
  const base = id === 'GUIDED' ? [] : current.filter(style => style !== 'GUIDED')
  return base.length >= MAX_STYLES ? base : [...base, id]
}

export function isExtended(styles: ActivityStyleId[]) {
  return styles.some(id => ACTIVITY_STYLES.find(style => style.id === id)?.extended)
}

/** Default learning goal when the teacher leaves it empty, matched to the kind of work. */
export function goalFor(styles: ActivityStyleId[], topic: string) {
  if (styles.includes('DEPLOY')) return `Aplicar ${topic} construyendo un producto funcional y publicándolo en internet.`
  if (styles.includes('APP')) return `Aplicar ${topic} construyendo una aplicación pequeña que cumpla criterios de aceptación.`
  if (styles.includes('CODE')) return `Aplicar ${topic} escribiendo código que pase casos de prueba.`
  if (styles.includes('TEAM')) return `Aplicar ${topic} en un proyecto en equipo con roles y entregas claras.`
  if (styles.includes('CASE')) return `Analizar un caso real con ${topic} y justificar una decisión.`
  if (styles.includes('LAB')) return `Comprobar ${topic} con un experimento y explicar los resultados.`
  if (styles.includes('PROBLEMS')) return `Resolver problemas de ${topic} mostrando el procedimiento.`
  if (styles.includes('SOURCES')) return `Analizar y contrastar fuentes sobre ${topic}.`
  if (styles.includes('ESSAY')) return `Argumentar una postura sobre ${topic} con evidencia.`
  if (styles.includes('READING')) return `Comprender e interpretar un texto sobre ${topic}.`
  if (styles.includes('WRITING')) return `Escribir un texto sobre ${topic} con propósito y destinatario claros.`
  if (styles.includes('ORAL')) return `Expresarse oralmente sobre ${topic} con fluidez y vocabulario adecuado.`
  return null
}

export type AcademicArea = 'programming' | 'math' | 'science' | 'humanities' | 'languages' | 'general'

export const AREA_LABEL: Record<AcademicArea, string> = {
  programming: 'Programación y sistemas', math: 'Matemáticas', science: 'Ciencias', humanities: 'Humanidades y ciencias sociales',
  languages: 'Idiomas y lenguaje', general: 'Cualquier materia',
}

/** Which kinds of work make sense in each area; the shared ones (guided, case, team) are always offered. */
const AREA_STYLES: Record<AcademicArea, ActivityStyleId[]> = {
  programming: ['GUIDED', 'CODE', 'APP', 'DEPLOY', 'PROBLEMS', 'CASE', 'TEAM'],
  math: ['GUIDED', 'PROBLEMS', 'CASE', 'TEAM'],
  science: ['GUIDED', 'PROBLEMS', 'LAB', 'CASE', 'TEAM'],
  humanities: ['GUIDED', 'SOURCES', 'ESSAY', 'READING', 'CASE', 'TEAM'],
  languages: ['GUIDED', 'READING', 'WRITING', 'ORAL', 'TEAM'],
  general: ['GUIDED', 'PROBLEMS', 'CASE', 'READING', 'ESSAY', 'TEAM'],
}

const AREA_WORDS: [AcademicArea, RegExp][] = [
  ['programming', /program|software|sistemas|algorit|c[oó]digo|desarrollo web|base[s]? de datos|patrones de dise|java|python|redes|computaci|inform[aá]tic|ingenier[ií]a de software|estructuras de datos|web|apps?\b/],
  ['math', /matem|[aá]lgebra|c[aá]lculo|geometr|estad[ií]stic|probabilidad|trigonom|aritm|ecuaciones|derivad|integral|l[oó]gica matem|precalc/],
  ['science', /f[ií]sica|qu[ií]mica|biolog|ciencias naturales|ecolog|anatom|gen[eé]tica|laboratorio|astronom|geolog/],
  ['languages', /ingl[eé]s|english|franc[eé]s|alem[aá]n|portugu[eé]s|italiano|idioma|lengua extranjera|espa[nñ]ol|lenguaje|lectura|redacci|literatura|comunicaci[oó]n oral/],
  ['humanities', /filosof|historia|sociales|sociolog|psicolog|[eé]tica|pol[ií]tica|derecho|antropolog|geograf|econom|religi|arte|m[uú]sica|constituci|ciudadan/],
]

/** Guesses the area from the course name and its topics; the teacher can still change it. */
export function detectArea(...texts: (string | null | undefined)[]): AcademicArea {
  const text = texts.filter(Boolean).join(' ').toLowerCase()
  for (const [area, pattern] of AREA_WORDS) if (pattern.test(text)) return area
  return 'general'
}

export function stylesFor(area: AcademicArea) {
  return AREA_STYLES[area].map(id => ACTIVITY_STYLES.find(style => style.id === id)!)
}

/** Examples in the form match the subject, so a history teacher does not read "ciclos for" or "Python". */
export const AREA_EXAMPLES: Record<AcademicArea, { topic: string; extra: string; lab: string }> = {
  programming: { topic: 'Ej. ciclos for, patrón Observer, consultas SQL…', extra: 'Ej.: que trabajen en parejas, incluye un ejercicio en Python.', lab: 'implementen el tema paso a paso, con código inicial, casos de prueba y entrega en GitHub' },
  math: { topic: 'Ej. eliminación de Gauss, derivadas, probabilidad…', extra: 'Ej.: con problemas de la vida real, que muestren el procedimiento.', lab: 'resuelvan problemas de dificultad creciente mostrando el procedimiento, con uno resuelto como modelo' },
  science: { topic: 'Ej. leyes de Newton, enlaces químicos, la célula…', extra: 'Ej.: incluye un experimento con materiales caseros.', lab: 'hagan un experimento sencillo con hipótesis, tabla de datos y conclusión' },
  humanities: { topic: 'Ej. la Ilustración, el contrato social, la Independencia…', extra: 'Ej.: con dos fuentes para contrastar y una pregunta para debatir.', lab: 'analicen y contrasten dos fuentes y escriban una conclusión argumentada' },
  languages: { topic: 'Ej. present perfect, conectores, comprensión lectora…', extra: 'Ej.: con un texto corto y un diálogo para practicar en parejas.', lab: 'practiquen con un texto corto, ejercicios de vocabulario y un diálogo en parejas' },
  general: { topic: 'Ej. el tema de esta semana…', extra: 'Ej.: que trabajen en parejas, con ejemplos de la vida real.', lab: 'apliquen el tema paso a paso en una actividad práctica con entrega' },
}
