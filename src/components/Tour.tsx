import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { Navigate, Route } from '../app/router'
import Owl, { type OwlPose } from './Owl'

type Step = {
  title: string
  text: string
  /** CSS selector of what to highlight; without it the card sits in the middle. */
  target?: string
  route?: Route
  params?: Record<string, string>
  pose?: OwlPose
}

/** The tour walks the real screens: each step opens its page and points at the control it explains. */
export const TOUR: Step[] = [
  { pose: 'wave', title: 'Bienvenido a FairTeam', text: 'Te muestro en un minuto cómo organizar tus cursos, calificar y preparar clases. Puedes salir cuando quieras y volver a verlo desde Ajustes.' },
  { target: '[data-tour="perfil"], .mobile-bar .icon-btn', title: 'Tu perfil', text: 'Aquí está tu cuenta. En Ajustes cambias el tema claro u oscuro, ves los atajos y vuelves a abrir este recorrido.' },
  { target: '.course-picker, .mobile-bar .icon-btn', title: 'Tus cursos y asignaturas', text: 'Cada asignatura o grupo es un curso. Cámbialo aquí; todo lo demás (estudiantes, notas, talleres) se muestra del curso elegido.' },
  { route: 'cursos', target: '.page-head', title: 'Crea tus cursos', text: 'En Mis cursos creas una asignatura nueva o cargas cursos de ejemplo para probar. Cada curso tiene su escala de notas: 5, 10, 100…' },
  { route: 'estudiantes', target: '.page-head', title: 'Registra a tus estudiantes', text: 'Pega la lista completa (un nombre por línea, con correo si quieres) o impórtala desde Excel. La plantilla está lista para descargar.' },
  { route: 'estudiantes', params: { vista: 'notas' }, target: '.grade-editor-bar', title: 'Tu libro de notas', text: 'Cada corte tiene columnas: un tema, taller o examen. Dale a cada una su porcentaje, arrástralas para ordenarlas y en "Definitiva" ves la nota final ponderada.' },
  { route: 'talleres', target: '.kind-picker', title: 'Talleres y quizzes', text: 'Elige taller, quiz o "A tu medida" y escribe lo que necesitas. Uso tu material (incluso un libro completo) y adapto las actividades a tu materia.' },
  { route: 'rubricas', target: '.page-head', title: 'Rúbricas', text: 'Crea una rúbrica desde un taller guardado. Luego calificas con un clic por criterio, la lista avanza sola y las notas llegan al libro.' },
  { target: '[data-tour="buho"], .buho-mobile', title: 'Búho, tu asistente', text: 'Pídele lo que quieras con palabras normales: "crea un taller de refuerzo de fracciones", "crea la rúbrica del último taller", "¿quién viene bajando?". Lo hace y te lo deja guardado.' },
  { route: 'seguimiento', target: '.page-head', title: 'Seguimiento', text: 'Aquí ves quién necesita apoyo, la tendencia por corte, la asistencia y cuánto necesita cada uno para aprobar.' },
  { pose: 'celebrate', title: '¡Listo para empezar!', text: 'Empieza por crear un curso o cargar los de ejemplo. Si te pierdes, pregúntale al Búho o vuelve a ver este recorrido en Ajustes.' },
]

const PAD = 8

/** First match that is on screen: on a phone the side menu is hidden, so its controls are skipped. */
function visible(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => {
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < window.innerWidth
  }) ?? null
}

/**
 * Interactive tour: dims the screen, cuts a window around the control being explained and shows a card
 * next to it. Arrow keys move between steps and Esc closes it.
 */
export default function Tour({ navigate, onClose }: { navigate: Navigate; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const step = TOUR[index]
  const last = index === TOUR.length - 1

  // Open the page of the step, then wait for its control to appear (pages load lazily).
  useEffect(() => {
    if (step.route) navigate(step.route, step.params)
    setRect(null)
    if (!step.target) return
    let tries = 0
    const find = () => {
      const element = visible(step.target!)
      const box = element?.getBoundingClientRect()
      if (element && box) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        window.setTimeout(() => setRect(element.getBoundingClientRect()), 280)
      } else if (++tries < 30) timer = window.setTimeout(find, 100)
      else setRect(null)
    }
    let timer = window.setTimeout(find, 120)
    return () => window.clearTimeout(timer)
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the control if the window changes size or the page scrolls.
  useEffect(() => {
    if (!step.target) return
    const update = () => { const element = visible(step.target!); if (element) setRect(element.getBoundingClientRect()) }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [step.target])

  const go = useCallback((delta: number) => {
    const next = index + delta
    if (next < 0) return
    if (next >= TOUR.length) { onClose(); return }
    setIndex(next)
  }, [index, onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight' || event.key === 'Enter') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  useLayoutEffect(() => { card.current?.focus() }, [index])

  // Card beside the highlighted control when there is room, below or above otherwise.
  const style: React.CSSProperties = {}
  if (rect) {
    const width = Math.min(360, window.innerWidth - 24)
    const right = rect.right + PAD + 16
    if (right + width < window.innerWidth) { style.left = right; style.top = Math.max(12, Math.min(rect.top, window.innerHeight - 280)) }
    else if (rect.bottom + 260 < window.innerHeight) { style.top = rect.bottom + PAD + 12; style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) }
    else { style.top = Math.max(12, rect.top - 260); style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) }
    style.width = width
  }

  return <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    {rect ? <div className="tour-hole" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      : <div className="tour-dim" />}
    <div ref={card} tabIndex={-1} className={`tour-card${rect ? '' : ' is-center'}`} style={style} key={index}>
      <button className="icon-btn tour-close" onClick={onClose} aria-label="Salir del recorrido"><X size={16} /></button>
      {!rect && step.pose && <Owl pose={step.pose} size={110} />}
      <small className="tour-count">Paso {index + 1} de {TOUR.length}</small>
      <h2 id="tour-title">{step.title}</h2>
      <p>{step.text}</p>
      <div className="tour-progress" aria-hidden><span style={{ transform: `scaleX(${(index + 1) / TOUR.length})` }} /></div>
      <div className="tour-actions">
        {index > 0 ? <button className="btn btn-ghost btn-small" onClick={() => go(-1)}><ArrowLeft size={15} aria-hidden />Atrás</button> : <button className="btn btn-ghost btn-small" onClick={onClose}>Ahora no</button>}
        <button className="btn btn-primary btn-small" onClick={() => go(1)}>{last ? 'Empezar' : index === 0 ? 'Mostrarme' : 'Siguiente'}{!last && <ArrowRight size={15} aria-hidden />}</button>
      </div>
    </div>
  </div>
}
