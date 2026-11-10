import type { Route } from '../app/router'

/**
 * "Primeros pasos": a guide that waits for the teacher to actually do each thing. Screens report what was
 * done with {@link guideDone}; some steps also count as done from the data (a course already exists).
 */
export type GuideStepId = 'perfil' | 'curso' | 'estudiantes' | 'columnas' | 'taller' | 'rubrica' | 'calificar' | 'libro' | 'buho'

/** Where the guide points: the first visible element that matches the selector (and contains the text). */
export type GuideTarget = { selector: string; text?: string }

export type GuideStep = {
  id: GuideStepId
  title: string
  /** What to do, in one or two sentences. */
  text: string
  /** Shown once the teacher is on the right screen. */
  hint: string
  route: Route
  params?: Record<string, string>
  targets: GuideTarget[]
  /** True when the step needs a course to make sense. */
  needsCourse?: boolean
}

export const GUIDE: GuideStep[] = [
  { id: 'perfil', route: 'ajustes', title: 'Revisa tu perfil', text: 'Mira tu cuenta y elige el tema claro u oscuro y la voz del Búho.', hint: 'Esta es tu cuenta. Cuando quieras, cambia la apariencia aquí abajo.',
    targets: [{ selector: '.panel.settings' }] },
  { id: 'curso', route: 'cursos', title: 'Crea tu asignatura', text: 'Cada asignatura o grupo es un curso, con su propia escala de notas.', hint: 'Toca "Crear curso", escribe el nombre (por ejemplo "Cálculo I — Grupo 2") y guárdalo.',
    targets: [{ selector: 'button', text: 'Crear curso' }, { selector: 'button', text: 'Crear mi primer curso' }] },
  { id: 'estudiantes', route: 'estudiantes', needsCourse: true, title: 'Registra a tus estudiantes', text: 'Pega la lista (un nombre por línea) o impórtala desde Excel.', hint: 'Toca "Agregar estudiantes" y pega los nombres; los repetidos se ignoran solos.',
    targets: [{ selector: 'button', text: 'Agregar estudiantes' }] },
  { id: 'columnas', route: 'estudiantes', params: { vista: 'notas' }, needsCourse: true, title: 'Organiza tus temas', text: 'En el libro de notas, cada columna es un tema, taller o examen del corte.', hint: 'Toca "Columna", escribe el tema y pon notas. Luego dale a cada columna su porcentaje.',
    targets: [{ selector: 'button', text: 'Columna' }, { selector: '.grade-editor-bar' }] },
  { id: 'taller', route: 'talleres', needsCourse: true, title: 'Crea un taller o quiz', text: 'Elige qué crear, escribe el tema y, si quieres, usa tu material.', hint: 'Elige Taller o Quiz, escribe el tema y toca "Crear". Queda guardado para usarlo después.',
    targets: [{ selector: '.kind-picker' }] },
  { id: 'rubrica', route: 'rubricas', needsCourse: true, title: 'Crea una rúbrica', text: 'Una rúbrica a partir de ese taller: la IA lee sus actividades y propone los criterios.', hint: 'Toca "Nueva rúbrica", elige el taller que guardaste y luego "Guardar".',
    targets: [{ selector: 'button', text: 'Nueva rúbrica' }, { selector: 'button', text: 'Crear mi primera rúbrica' }] },
  { id: 'calificar', route: 'rubricas', needsCourse: true, title: 'Califica con la rúbrica', text: 'Un clic por criterio; al terminar un estudiante pasa solo al siguiente.', hint: 'Abre tu rúbrica, ve a "Evaluar" y elige un nivel en cada criterio.',
    targets: [{ selector: '[role="tab"]', text: 'Evaluar' }, { selector: '.rubric-card' }] },
  { id: 'libro', route: 'rubricas', needsCourse: true, title: 'Lleva las notas al libro', text: 'Las notas de la rúbrica pasan a una columna del libro de notas.', hint: 'Toca "Llevar … al libro", elige el corte y el nombre de la columna.',
    targets: [{ selector: 'button', text: 'al libro' }, { selector: '.rubric-card' }] },
  { id: 'buho', route: 'inicio', title: 'Pídele algo a Búho', text: 'Escríbele como a un colega: "crea un quiz de derivadas de reto" o "¿quién viene bajando?".', hint: 'Abre el Búho (Ctrl K) y pídele algo. Lo hace y te lo deja guardado.',
    targets: [{ selector: '[data-tour="buho"]' }, { selector: '.buho-mobile' }] },
]

export const GUIDE_EVENT = 'fairteam:guide-done'
export const GUIDE_OPEN_EVENT = 'fairteam:guide-open'

/** Called by the screens when the teacher does something the guide is waiting for. */
export function guideDone(id: GuideStepId) {
  window.dispatchEvent(new CustomEvent<GuideStepId>(GUIDE_EVENT, { detail: id }))
}

export function openGuide() { window.dispatchEvent(new Event(GUIDE_OPEN_EVENT)) }

export type GuideState = { open: boolean; minimized: boolean; done: GuideStepId[]; skipped: GuideStepId[]; finished: boolean }

export const initialGuide: GuideState = { open: true, minimized: false, done: [], skipped: [], finished: false }

export function readGuide(key: string): GuideState | null {
  try { const raw = localStorage.getItem(key); return raw ? { ...initialGuide, ...JSON.parse(raw) as Partial<GuideState> } : null } catch { return null }
}

export function writeGuide(key: string, state: GuideState) {
  try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* private mode */ }
}

/** The first step neither done nor skipped, or null when the guide is complete. */
export function currentStep(state: GuideState): GuideStep | null {
  return GUIDE.find(step => !state.done.includes(step.id) && !state.skipped.includes(step.id)) ?? null
}

export function markDone(state: GuideState, ids: GuideStepId[]): GuideState {
  const fresh = ids.filter(id => !state.done.includes(id))
  if (!fresh.length) return state
  return { ...state, done: [...state.done, ...fresh], skipped: state.skipped.filter(id => !fresh.includes(id)) }
}

/** The first element on screen that matches one of the targets. */
export function findTarget(targets: GuideTarget[]): HTMLElement | null {
  for (const target of targets) {
    const match = [...document.querySelectorAll<HTMLElement>(target.selector)].find(element => {
      if (target.text && !element.textContent?.toLowerCase().includes(target.text.toLowerCase())) return false
      if (element.closest('.guide')) return false
      const box = element.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight + 400 && box.left < window.innerWidth
    })
    if (match) return match
  }
  return null
}
