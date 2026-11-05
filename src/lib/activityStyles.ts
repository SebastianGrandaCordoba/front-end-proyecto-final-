/** Kinds of work a workshop can ask for. Ids match the AI service (activityStyles). */
export type ActivityStyleId = 'GUIDED' | 'CODE' | 'APP' | 'DEPLOY' | 'CASE' | 'TEAM'

export interface ActivityStyle { id: ActivityStyleId; label: string; detail: string; extended: boolean }

export const ACTIVITY_STYLES: ActivityStyle[] = [
  { id: 'GUIDED', label: 'Ejercicios guiados', detail: 'Práctica paso a paso para una clase.', extended: false },
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
  return null
}
