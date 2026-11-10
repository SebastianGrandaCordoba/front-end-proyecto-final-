import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronUp, Compass, Minus, SkipForward, X } from 'lucide-react'
import type { Navigate, Route } from '../app/router'
import Owl from './Owl'
import {
  GUIDE, GUIDE_EVENT, GUIDE_OPEN_EVENT, currentStep, findTarget, initialGuide, markDone, readGuide, writeGuide,
  type GuideState, type GuideStep, type GuideStepId,
} from '../lib/guide'

/** What the app already knows, so steps the teacher did before (or elsewhere) count as done. */
export type GuideSignals = { courses: number; students: number; columns: boolean; workshops: number; hasCourse: boolean }

/**
 * "Primeros pasos": a companion that does not block the screen. It says what to do, takes the teacher to the
 * right page, rings the exact button and waits until the teacher really does it; then it ticks the step and
 * moves on. It can be minimized, skipped step by step, closed and opened again from Ajustes or the Búho.
 */
export default function Guide({ userId, route, params, navigate, signals, onQuickTour }: {
  userId: number; route: Route; params: URLSearchParams; navigate: Navigate; signals: GuideSignals; onQuickTour: () => void
}) {
  const key = `fairteam.guide.${userId}`
  const [state, setState] = useState<GuideState>(() => readGuide(key) ?? initialGuide)
  const [welcome, setWelcome] = useState(() => readGuide(key) === null)
  const [showAll, setShowAll] = useState(false)
  const [focus, setFocus] = useState<GuideStepId | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [ring, setRing] = useState<DOMRect | null>(null)
  const ringTarget = useRef<HTMLElement | null>(null)
  const card = useRef<HTMLElement | null>(null)
  const [onTop, setOnTop] = useState(false)

  const update = useCallback((next: (s: GuideState) => GuideState) => setState(current => {
    const value = next(current)
    writeGuide(key, value)
    return value
  }), [key])

  // Screens report what the teacher did.
  useEffect(() => {
    const onDone = (event: Event) => {
      const id = (event as CustomEvent<GuideStepId>).detail
      setState(current => {
        if (current.done.includes(id)) return current
        const value = markDone(current, [id])
        writeGuide(key, value)
        const step = GUIDE.find(s => s.id === id)
        if (current.open && step) setFlash(step.title)
        return value
      })
    }
    const onOpen = () => { setWelcome(false); update(s => ({ ...s, open: true, minimized: false, finished: false })) }
    window.addEventListener(GUIDE_EVENT, onDone)
    window.addEventListener(GUIDE_OPEN_EVENT, onOpen)
    return () => { window.removeEventListener(GUIDE_EVENT, onDone); window.removeEventListener(GUIDE_OPEN_EVENT, onOpen) }
  }, [key, update])
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(null), 2600); return () => window.clearTimeout(t) }, [flash])

  // Steps already done with real data count too (a course that exists, students already loaded…).
  useEffect(() => {
    const done: GuideStepId[] = []
    if (signals.courses > 0) done.push('curso')
    if (signals.students > 0) done.push('estudiantes')
    if (signals.columns) done.push('columnas')
    if (signals.workshops > 0) done.push('taller')
    if (route === 'ajustes') done.push('perfil')
    if (!done.length) return
    setState(current => {
      const value = markDone(current, done)
      if (value === current) return current
      writeGuide(key, value)
      const fresh = GUIDE.filter(s => done.includes(s.id) && !current.done.includes(s.id) && s.id !== 'perfil')
      if (current.open && !current.minimized && fresh.length) setFlash(fresh[fresh.length - 1].title)
      return value
    })
  }, [key, signals.courses, signals.students, signals.columns, signals.workshops, route])

  const step: GuideStep | null = useMemo(() => {
    const focused = focus ? GUIDE.find(s => s.id === focus && !state.done.includes(s.id)) : undefined
    return focused ?? currentStep(state)
  }, [focus, state])
  const doneCount = state.done.length
  const here = !!step && step.route === route && (!step.params?.vista || params.get('vista') === step.params.vista)
  const blocked = !!step?.needsCourse && !signals.hasCourse
  const visible = state.open && !welcome && !state.minimized

  // Ring the control the step is about while the teacher is on its page.
  useEffect(() => {
    setRing(null); ringTarget.current = null
    if (!visible || !step || !here || blocked) return
    let tries = 0
    let timer = 0
    const look = () => {
      const element = findTarget(step.targets)
      if (element) { ringTarget.current = element; setRing(element.getBoundingClientRect()) }
      else if (++tries < 40) timer = window.setTimeout(look, 150)
    }
    timer = window.setTimeout(look, 200)
    const follow = () => { if (ringTarget.current?.isConnected) setRing(ringTarget.current.getBoundingClientRect()); else { ringTarget.current = null; tries = 0; look() } }
    const interval = window.setInterval(follow, 600)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow) }
  }, [visible, step, here, blocked, route])

  // Room at the end of every page so nothing stays under the card; the card moves up if it covers the ring.
  useEffect(() => {
    document.body.classList.toggle('guide-open', visible)
    return () => document.body.classList.remove('guide-open')
  }, [visible])
  useEffect(() => {
    if (!ring || !card.current) { setOnTop(false); return }
    const box = card.current.getBoundingClientRect()
    const hits = (top: number) => !(ring.right < box.left || ring.left > box.right || ring.bottom < top || ring.top > top + box.height)
    const below = window.innerHeight - 20 - box.height
    setOnTop(hits(below) && !hits(20))
  }, [ring])

  const take = (target: GuideStep) => {
    setFocus(target.id)
    navigate(target.route, target.params)
    window.setTimeout(() => findTarget(target.targets)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 450)
  }
  const skip = () => { if (step) { setFocus(null); update(s => ({ ...s, skipped: [...s.skipped.filter(id => id !== step.id), step.id] })) } }
  const close = () => update(s => ({ ...s, open: false }))
  const start = () => { setWelcome(false); update(s => ({ ...s, open: true, minimized: false })) }
  // "Later" leaves a small pill in the corner instead of a card over the page.
  const later = useCallback(() => { setWelcome(false); update(s => ({ ...s, open: true, minimized: true })) }, [update])
  useEffect(() => {
    if (!welcome) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') later() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [welcome, later])

  if (!state.open) return null

  if (welcome) {
    return <div className="guide guide-welcome" role="dialog" aria-labelledby="guide-welcome-title">
      <Owl pose="wave" size={96} />
      <h2 id="guide-welcome-title">¿Empezamos juntos?</h2>
      <p>Te acompaño mientras haces lo básico: crear tu curso, registrar estudiantes, preparar un taller, calificar con rúbrica y usar el Búho. Tú lo haces; yo te digo dónde tocar.</p>
      <div className="guide-actions">
        <button className="btn btn-primary" onClick={start}>Empezar<ArrowRight size={15} aria-hidden /></button>
        <button className="btn btn-ghost" onClick={() => { start(); onQuickTour() }}>Ver un recorrido rápido</button>
        <button className="link-btn" onClick={later}>Ahora no</button>
      </div>
    </div>
  }

  if (state.minimized) {
    return <button className="guide-pill" onClick={() => update(s => ({ ...s, minimized: false }))} aria-label="Abrir primeros pasos">
      <Compass size={16} aria-hidden /><span>Primeros pasos</span><b className="num">{doneCount}/{GUIDE.length}</b>
    </button>
  }

  return <>
    {ring && <div className="guide-ring" style={{ top: ring.top - 6, left: ring.left - 6, width: ring.width + 12, height: ring.height + 12 }} aria-hidden />}
    <aside ref={card} className={`guide${onTop ? ' is-top' : ''}`} aria-label="Primeros pasos" aria-live="polite">
      <header className="guide-head">
        <Compass size={16} aria-hidden /><b>Primeros pasos</b><span className="num">{doneCount} de {GUIDE.length}</span>
        <button className="icon-btn" onClick={() => update(s => ({ ...s, minimized: true }))} aria-label="Minimizar"><Minus size={16} /></button>
        <button className="icon-btn" onClick={close} aria-label="Cerrar la guía"><X size={16} /></button>
      </header>
      <div className="guide-bar" aria-hidden><span style={{ transform: `scaleX(${doneCount / GUIDE.length})` }} /></div>

      {flash && <p className="guide-flash"><Check size={15} aria-hidden />¡Hecho! {flash}</p>}

      {step ? <div className="guide-step" key={step.id}>
        <small>Paso {GUIDE.indexOf(step) + 1}</small>
        <h3>{step.title}</h3>
        <p>{blocked ? 'Para esto necesitas un curso: crea uno primero o elige uno arriba a la izquierda.' : here ? step.hint : step.text}</p>
        {here && !blocked && !ring && <p className="guide-note">Si no ves el botón, desplázate un poco: está en esta página.</p>}
        <div className="guide-actions">
          {!here && !blocked && <button className="btn btn-primary btn-small" onClick={() => take(step)}>Llévame<ArrowRight size={15} aria-hidden /></button>}
          {blocked && <button className="btn btn-primary btn-small" onClick={() => navigate('cursos')}>Ir a Mis cursos</button>}
          <button className="btn btn-ghost btn-small" onClick={skip}><SkipForward size={14} aria-hidden />Saltar</button>
        </div>
      </div> : <div className="guide-step guide-done">
        <Owl pose="celebrate" size={84} />
        <h3>¡Ya dominas lo básico!</h3>
        <p>Cuando quieras repasar, abre esta guía desde Ajustes o pídele al Búho "tutorial".</p>
        <div className="guide-actions"><button className="btn btn-primary btn-small" onClick={() => update(s => ({ ...s, open: false, finished: true }))}>Cerrar</button></div>
      </div>}

      <button className="guide-toggle" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
        {showAll ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}{showAll ? 'Ocultar los pasos' : 'Ver todos los pasos'}
      </button>
      {showAll && <ol className="guide-list">{GUIDE.map(item => {
        const done = state.done.includes(item.id)
        return <li key={item.id} className={`${done ? 'is-done' : ''}${item.id === step?.id ? ' is-current' : ''}`}>
          <button onClick={() => done ? undefined : take(item)} disabled={done}>
            <span className="guide-check" aria-hidden>{done ? <Check size={13} /> : GUIDE.indexOf(item) + 1}</span>
            <span>{item.title}</span>{state.skipped.includes(item.id) && !done && <em>saltado</em>}
          </button>
        </li>
      })}</ol>}
    </aside>
  </>
}
