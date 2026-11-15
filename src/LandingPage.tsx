import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, BarChart3, Check, ClipboardCheck, FileDown, FileSpreadsheet, FolderOpen, Mic, ShieldCheck, Sparkles, TrendingDown } from 'lucide-react'
import FairTeamMark from './FairTeamMark'
import Owl from './components/Owl'
import './landing.css'

type Props = { onLogin: () => void; onRegister: () => void }

const grade = (value: number) => value.toFixed(1).replace('.', ',')
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/* Fictitious course used in every example of the page. */
const TOPICS = ['Límites', 'Derivadas', 'Integrales']
const ROWS: { name: string; grades: number[]; note?: string }[] = [
  { name: 'Valentina Rojas', grades: [3.1, 2.2, 2.6], note: 'viene bajando' },
  { name: 'Santiago Gómez', grades: [3.8, 2.7, 3.6] },
  { name: 'Mariana López', grades: [4.4, 3.9, 4.2] },
  { name: 'Juan Pablo Castaño', grades: [3.4, 2.4, 3.0], note: 'necesita 3,8 para pasar' },
  { name: 'Camila Ospina', grades: [4.6, 4.1, 4.5] },
]
const SUBJECTS = ['Cálculo', 'Programación', 'Química', 'Historia', 'Física', 'Biología', 'Inglés', 'Estadística', 'Álgebra', 'Literatura', 'Bases de datos', 'Geografía']

/** A red-pen circle that draws itself around a number. */
function PenCircle({ at }: { at: number }) {
  return <svg className="pen" viewBox="0 0 64 34" aria-hidden style={delay(at)}><path d="M8 18C6 7 24 2 40 4c16 2 24 9 20 17-4 8-24 11-40 8C10 27 4 23 9 15" /></svg>
}

function Gradebook() {
  return <figure className="lp-book" aria-label="Ejemplo: la planilla de Cálculo I con las señales de FairTeam">
    <figcaption><b>Cálculo I — Grupo 2</b><span>Corte 2 · datos ficticios</span></figcaption>
    <table>
      <thead><tr><th scope="col">Estudiante</th>{TOPICS.map(topic => <th key={topic} scope="col">{topic}</th>)}</tr></thead>
      <tbody>{ROWS.map((row, r) => <tr key={row.name}>
        <th scope="row">{row.name}{row.note && <em style={delay(2600 + r * 200)}><TrendingDown size={12} aria-hidden />{row.note}</em>}</th>
        {row.grades.map((value, c) => <td key={c} className={value < 3 ? 'is-low' : ''} style={delay(500 + r * 220 + c * 90)}>
          <span>{grade(value)}</span>{value < 3 && <PenCircle at={1900 + r * 260 + c * 120} />}
        </td>)}
      </tr>)}</tbody>
    </table>
  </figure>
}

function Hero({ onRegister, onLogin }: Props) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect()
      el.style.setProperty('--mx', String((event.clientX - box.left) / box.width - 0.5))
      el.style.setProperty('--my', String((event.clientY - box.top) / box.height - 0.5))
    }
    el.addEventListener('pointermove', move)
    return () => el.removeEventListener('pointermove', move)
  }, [])
  return <section className="lp-hero" ref={ref}>
    <div className="lp-blob b1" aria-hidden /><div className="lp-blob b2" aria-hidden /><div className="lp-blob b3" aria-hidden />
    <div className="lp-hero-copy">
      <p className="lp-kicker"><Sparkles size={14} aria-hidden /> Para docentes de cualquier materia</p>
      <h1 aria-label="Sabe a quién apoyar antes de entrar a clase.">
        <span className="line" aria-hidden><i style={delay(80)}>Sabe a quién</i></span>
        <span className="line" aria-hidden><i style={delay(200)}>apoyar antes de</i></span>
        <span className="line" aria-hidden><i style={delay(320)}>entrar a clase.</i></span>
      </h1>
      <p className="lp-lede">FairTeam lee las notas de tu curso, te dice quién necesita refuerzo y en qué tema, y te deja listo el taller, el quiz o la rúbrica para trabajarlo.</p>
      <div className="lp-actions">
        <button className="lp-btn lp-btn-main" onClick={onRegister}>Crear cuenta gratis <ArrowRight size={18} aria-hidden /></button>
        <button className="lp-btn lp-btn-line" onClick={onLogin}>Ya tengo cuenta</button>
      </div>
      <ul className="lp-proof"><li><Check size={15} aria-hidden />Importa tu Excel tal como lo tienes</li><li><Check size={15} aria-hidden />Tú revisas todo antes de usarlo</li></ul>
    </div>
    <div className="lp-stage" aria-hidden={false}>
      <div className="lp-layer l1"><Gradebook /></div>
      <div className="lp-layer l2 lp-chip alert"><span className="dot" />3 necesitan refuerzo en Derivadas</div>
      <div className="lp-layer l3 lp-bubble"><FairTeamMark size={30} /><p>Ya preparé un taller con tu material.<b>Ver el taller</b></p></div>
      <div className="lp-layer l4 lp-chip good"><Check size={14} aria-hidden />Quiz listo para revisar</div>
    </div>
  </section>
}

function Marquee() {
  const items = [...SUBJECTS, ...SUBJECTS]
  return <div className="lp-marquee" aria-label="Funciona con cualquier materia"><div className="track">{items.map((s, i) => <span key={i} aria-hidden={i >= SUBJECTS.length}>{s}</span>)}</div></div>
}

const STEPS = [
  { title: 'Organiza tus cursos', text: 'Cada materia o grupo es un curso con su lista, sus cortes y su escala: sobre 5, 10, 100 o la que uses. Pega la lista o impórtala desde Excel.' },
  { title: 'Revisa el progreso', text: 'El libro de notas calcula promedios, porcentajes y la definitiva. Ves cómo se mueve cada estudiante de un corte al siguiente.' },
  { title: 'Recibe señales', text: 'Quién está por debajo de la nota para aprobar, quién viene bajando, qué tema cuesta más y cuánto necesita cada uno en lo que falta del semestre.' },
  { title: 'Prepara actividades', text: 'Talleres, quizzes y rúbricas hechos con tu material y pensados para tu área. Los revisas, los ajustas y los descargas para imprimir, con la clave solo para ti.' },
]

function StepVisual({ step }: { step: number }) {
  if (step === 0) return <div className="sv sv-courses"><span className="on"><FolderOpen size={18} />Cálculo I — Grupo 2<small>32 estudiantes</small></span><span><FolderOpen size={18} />Álgebra lineal — Grupo 1<small>28 estudiantes</small></span><span><FolderOpen size={18} />Estadística — Grupo 4<small>35 estudiantes</small></span></div>
  if (step === 1) return <div className="sv sv-bars">{[['Valentina', 78, '3,1'], ['Santiago', 64, '3,2'], ['Camila', 92, '4,6']].map(([n, w, g], i) => <div key={n as string} style={delay(i * 120)}><b>{n}</b><i><u style={{ width: `${w}%` }} /></i><em>{g}</em></div>)}<p>Corte 1 → Corte 2</p></div>
  if (step === 2) return <div className="sv sv-signals"><span className="s red" style={delay(0)}><b>3</b> necesitan refuerzo en Derivadas</span><span className="s amber" style={delay(140)}><b>2</b> vienen bajando desde el corte 1</span><span className="s blue" style={delay(280)}>Juan Pablo necesita <b>3,8</b> para pasar</span></div>
  return <div className="sv sv-activity"><h4>Taller de refuerzo: la derivada como razón de cambio</h4><p>3 actividades · 50 min · con pistas</p><span style={delay(100)}><FileDown size={16} />Hoja para estudiantes</span><span style={delay(220)}><ClipboardCheck size={16} />Clave docente</span></div>
}

function Story() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLLIElement | null)[]>([])
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.i))
    }, { rootMargin: '-45% 0px -45% 0px' })
    refs.current.forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])
  return <section className="lp-story" id="como-funciona" aria-labelledby="story-title">
    <h2 id="story-title">De la planilla a la clase, en cuatro pasos</h2>
    <div className="lp-story-grid">
      <ol className="lp-steps">{STEPS.map((s, i) => <li key={s.title} data-i={i} ref={el => { refs.current[i] = el }} className={i === active ? 'on' : ''}>
        <span className="num">{i + 1}</span><div><h3>{s.title}</h3><p>{s.text}</p></div>
      </li>)}</ol>
      <div className="lp-stage-sticky"><div className="lp-window" aria-hidden><div className="bar"><i /><i /><i /></div><div className="body" key={active}><StepVisual step={active} /></div></div></div>
    </div>
  </section>
}

function Bento() {
  return <section className="lp-bento" id="que-incluye" aria-labelledby="bento-title">
    <h2 id="bento-title">Todo lo que necesitas, en un solo lugar</h2>
    <div className="grid">
      <article className="tile t-chat">
        <h3>Pregúntale a Búho con tus palabras</h3><p>Responde con los datos de tu curso y hace el trabajo: crea el quiz, arma la rúbrica o te lleva al botón que buscas.</p>
        <div className="chat"><span className="me" style={delay(300)}>¿Quién necesita refuerzo en Derivadas?</span><span className="bu" style={delay(1300)}>3 estudiantes están por debajo de 3,0. El promedio del tema es 2,9.</span><span className="bu act" style={delay(2300)}>Preparar el taller de Derivadas</span></div>
      </article>
      <article className="tile t-rubric">
        <h3>Califica con rúbrica, un clic por criterio</h3><p>Cuatro niveles descritos por criterio; la lista pasa sola al siguiente estudiante.</p>
        <div className="levels">{['Excelente', 'Bueno', 'Básico', 'Insuficiente'].map((l, i) => <span key={l} className={i === 1 ? 'pick' : ''}>{l}</span>)}</div>
      </article>
      <article className="tile t-map">
        <h3>Un mapa para ver dónde reforzar</h3><p>Rojo es lo que hay que retomar; verde, lo que el grupo domina.</p>
        <div className="heat" aria-hidden>{['r', 'a', 'v', 'a', 'r', 'v', 'v', 'a', 'a', 'r', 'v', 'v'].map((c, i) => <i key={i} className={c} style={delay(i * 70)} />)}</div>
      </article>
      <article className="tile t-voice">
        <h3>Te lee el resumen del día</h3><p>Con voz natural, mientras te preparas.</p>
        <div className="wave" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={delay(i * 60)} />)}</div><Mic className="mic" size={20} aria-hidden />
      </article>
      <article className="tile t-excel">
        <h3>Importa tu Excel tal cual</h3><p>Reconoce columnas como Nombre, Materia, Nota y Periodo.</p>
        <div className="file"><FileSpreadsheet size={28} aria-hidden /><span>notas_corte2.xlsx</span><BarChart3 size={18} aria-hidden /></div>
      </article>
    </div>
  </section>
}

function useCount(target: number, started: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!started) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return }
    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => { const p = Math.min((now - t0) / 1100, 1); setValue(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, started])
  return value
}

function Trust() {
  const ref = useRef<HTMLElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); o.disconnect() } }, { threshold: .35 })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  const a = useCount(0, seen), b = useCount(1, seen), c = useCount(3, seen), d = useCount(4, seen)
  return <section className="lp-trust" id="tus-datos" ref={ref} aria-labelledby="trust-title">
    <h2 id="trust-title"><ShieldCheck size={30} aria-hidden /> Tú tienes la última palabra</h2>
    <ul>
      <li><b>{a}</b><span>nombres de estudiantes enviados a la IA: solo recibe el material y un resumen del curso</span></li>
      <li><b>{b}</b><span>clic por criterio para calificar con rúbrica</span></li>
      <li><b>{c}</b><span>tonos para los mensajes a estudiantes: cercano, motivador y formal</span></li>
      <li><b>{d}</b><span>niveles descritos en cada criterio de la rúbrica</span></li>
    </ul>
  </section>
}

const FAQ = [
  ['¿Necesito pasar mis notas a otro formato?', 'No. Importas el Excel o el CSV que ya tienes; FairTeam reconoce columnas como Nombre, Materia, Nota y Periodo. También puedes pegar la lista o escribir las notas directamente.'],
  ['¿La IA ve los nombres de mis estudiantes?', 'No. A la IA solo le llega el material que subes y un resumen del curso; los estudiantes viajan como códigos, sin nombres, correos ni notas individuales.'],
  ['¿Puedo cambiar lo que genera la IA?', 'Sí. Cada taller, quiz o rúbrica es un borrador: lo revisas, lo ajustas y decides si lo usas o lo descargas.'],
  ['¿Sirve para cualquier escala de notas?', 'Sí. Cada curso tiene su propia escala: sobre 5, 10, 100 o la que uses, y su nota para aprobar.'],
  ['¿Quién ve mis cursos?', 'Solo tú. Cada cuenta y cada curso están separados.'],
]

function Faq() {
  return <section className="lp-faq" aria-labelledby="faq-title"><h2 id="faq-title">Preguntas frecuentes</h2>
    <div>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
}

export default function LandingPage({ onLogin, onRegister }: Props) {
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle('stuck', window.scrollY > 12)
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.lp [data-reveal]')
    const o = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target) } }), { threshold: .15 })
    els.forEach(el => o.observe(el))
    return () => o.disconnect()
  }, [])
  return <div className="lp">
    <header className="lp-nav" ref={navRef}>
      <a className="lp-brand" href="#" aria-label="FairTeam, inicio"><FairTeamMark size={34} /><span translate="no">FairTeam</span></a>
      <nav aria-label="Secciones"><a href="#como-funciona">Cómo funciona</a><a href="#que-incluye">Qué incluye</a><a href="#tus-datos">Tus datos</a></nav>
      <div className="lp-nav-actions"><button className="lp-btn lp-btn-ghost" onClick={onLogin}>Entrar</button><button className="lp-btn lp-btn-main small" onClick={onRegister}>Crear cuenta</button></div>
    </header>
    <main>
      <Hero onLogin={onLogin} onRegister={onRegister} />
      <Marquee />
      <Story />
      <div data-reveal><Bento /></div>
      <div data-reveal><Trust /></div>
      <div data-reveal><Faq /></div>
      <section className="lp-cta" data-reveal>
        <div className="glow" aria-hidden />
        <Owl pose="celebrate" size={170} className="lp-cta-owl" />
        <div><h2>Empieza con el curso que tienes este semestre.</h2><p>Crear la cuenta toma un minuto. Una guía te acompaña en los primeros pasos.</p>
          <div className="lp-actions"><button className="lp-btn lp-btn-white" onClick={onRegister}>Crear cuenta gratis <ArrowRight size={18} aria-hidden /></button><button className="lp-btn lp-btn-glass" onClick={onLogin}>Entrar</button></div></div>
      </section>
    </main>
    <footer className="lp-foot"><span><FairTeamMark size={22} /> FairTeam · Proyecto final de Patrones de diseño</span><a href="#como-funciona">Cómo funciona</a><button onClick={onLogin}>Entrar</button></footer>
  </div>
}
