import type { CSSProperties } from 'react'
import { ArrowRight, Check, ClipboardCheck, FileDown, TrendingDown } from 'lucide-react'
import FairTeamMark from './FairTeamMark'
import Owl from './components/Owl'

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

/**
 * The hero is the product's one idea shown on a real grade sheet: grades land, the low ones get the
 * highlighter, the notes in the margin say why, and Búho closes with the activity ready.
 */
function PlanillaDemo() {
  return <figure className="lp-sheet" aria-label="Ejemplo: la planilla de Cálculo I con las señales de FairTeam">
    <figcaption className="lp-sheet-head"><b>Cálculo I — Grupo 2</b><span>Corte 2 · ejemplo con datos ficticios</span></figcaption>
    <table>
      <thead><tr><th scope="col">Estudiante</th>{TOPICS.map((topic, i) => <th key={topic} scope="col" className={i === 1 ? 'is-hard' : ''}>{topic}{i === 1 && <em style={delay(2500)}>el tema que más cuesta</em>}</th>)}</tr></thead>
      <tbody>{ROWS.map((row, r) => <tr key={row.name}>
        <th scope="row">{row.name}{row.note && <em style={delay(2900 + r * 180)}><TrendingDown size={12} aria-hidden />{row.note}</em>}</th>
        {row.grades.map((value, c) => <td key={c} className={value < 3 ? 'is-low' : ''} style={delay(350 + r * 230 + c * 90)}><span>{grade(value)}</span></td>)}
      </tr>)}</tbody>
    </table>
    <div className="lp-sheet-buho" style={delay(3700)}>
      <FairTeamMark size={34} />
      <p><b>3 estudiantes necesitan refuerzo en Derivadas.</b> Ya tengo listo un taller con tu material de clase.</p>
      <span className="lp-fake-btn">Ver el taller</span>
    </div>
  </figure>
}

export default function LandingPage({ onLogin, onRegister }: Props) {
  return <div className="lp">
    <header className="lp-nav">
      <a className="lp-brand" href="#" aria-label="FairTeam, inicio"><FairTeamMark size={34} /><span className="wordmark" translate="no">FairTeam</span></a>
      <nav aria-label="Secciones"><a href="#como-funciona">Cómo funciona</a><a href="#que-incluye">Qué incluye</a><a href="#tus-datos">Tus datos</a></nav>
      <div className="lp-nav-actions"><button className="btn btn-ghost" onClick={onLogin}>Entrar</button><button className="btn btn-primary" onClick={onRegister}>Crear cuenta</button></div>
    </header>

    <main>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>Sabe a quién apoyar antes de entrar a clase.</h1>
          <p>FairTeam lee la planilla de notas de tu curso, te señala quién necesita refuerzo y en qué tema, y te deja listo el taller, el quiz o la rúbrica para trabajarlo.</p>
          <div className="lp-actions">
            <button className="btn btn-primary btn-large" onClick={onRegister}>Crear cuenta gratis</button>
            <button className="btn btn-secondary btn-large" onClick={onLogin}>Ya tengo cuenta</button>
          </div>
          <ul className="lp-proof">
            <li><Check size={16} aria-hidden />Para docentes de cualquier materia</li>
            <li><Check size={16} aria-hidden />Importas tu Excel tal como lo tienes</li>
          </ul>
        </div>
        <PlanillaDemo />
      </section>

      <section className="lp-flow" id="como-funciona" aria-labelledby="flow-title">
        <h2 id="flow-title">De la planilla a la clase, en cuatro pasos</h2>
        <ol>
          <li>
            <span className="lp-step" aria-hidden>1</span>
            <div><h3>Organiza tus cursos</h3><p>Cada materia o grupo es un curso con su lista, sus cortes y su escala de notas: sobre 5, 10, 100 o la que uses. Pegas la lista o importas el Excel.</p></div>
            <div className="lp-frag lp-frag-courses" aria-hidden><span className="is-on">Cálculo I — Grupo 2<small>32 estudiantes</small></span><span>Álgebra lineal — Grupo 1<small>28 estudiantes</small></span></div>
          </li>
          <li>
            <span className="lp-step" aria-hidden>2</span>
            <div><h3>Revisa el progreso</h3><p>El libro de notas calcula promedios, porcentajes y la definitiva. Ves cómo se mueve cada estudiante de un corte al siguiente.</p></div>
            <div className="lp-frag lp-frag-trend" aria-hidden>
              <span><b>Valentina</b><i>3,4</i><i>3,0</i><i className="is-low">2,6</i></span>
              <span><b>Santiago</b><i>3,2</i><i>3,3</i><i>3,4</i></span>
              <span><b>Camila</b><i>4,1</i><i>4,3</i><i className="is-high">4,5</i></span>
            </div>
          </li>
          <li>
            <span className="lp-step" aria-hidden>3</span>
            <div><h3>Recibe señales</h3><p>Quién está por debajo de la nota para aprobar, quién viene bajando, qué tema cuesta más y cuánto necesita cada uno en lo que falta del semestre.</p></div>
            <div className="lp-frag lp-frag-signals" aria-hidden>
              <span><mark>3 necesitan refuerzo</mark> en Derivadas</span>
              <span><mark>2 vienen bajando</mark> desde el corte 1</span>
              <span>Juan Pablo necesita <mark>3,8</mark> para pasar</span>
            </div>
          </li>
          <li>
            <span className="lp-step" aria-hidden>4</span>
            <div><h3>Prepara actividades</h3><p>Talleres, quizzes y rúbricas hechos con tu material y pensados para tu área. Los revisas, los ajustas y los descargas para imprimir, con la clave solo para ti.</p></div>
            <div className="lp-frag lp-frag-doc" aria-hidden><b>Taller de refuerzo: la derivada como razón de cambio</b><small>3 actividades · 50 min · con pistas</small><span><FileDown size={14} />Hoja para estudiantes</span><span><FileDown size={14} />Clave docente</span></div>
          </li>
        </ol>
      </section>

      <section className="lp-features" id="que-incluye" aria-label="Qué incluye">
        <article className="lp-feature">
          <div className="lp-feature-copy">
            <h2>Pregúntale a Búho con tus palabras</h2>
            <p>Búho es el asistente de FairTeam. Responde con los datos de tu curso y hace el trabajo: crea el quiz, arma la rúbrica del último taller o te lleva al botón que estás buscando.</p>
            <ul><li>“¿Qué estudiante va peor en esta materia?”</li><li>“Crea un quiz de derivadas, de reto”</li><li>“¿Cómo pongo porcentajes a las notas?”</li></ul>
          </div>
          <div className="lp-chat" aria-hidden>
            <p className="lp-chat-me">¿Quién necesita refuerzo en Derivadas?</p>
            <div className="lp-chat-buho"><FairTeamMark size={28} />
              <div><p>En Derivadas, 3 estudiantes están por debajo de 3,0. El promedio del tema es 2,9.</p>
                <ul><li><b>Valentina Rojas</b><i>2,2</i></li><li><b>Juan Pablo Castaño</b><i>2,4</i></li><li><b>Santiago Gómez</b><i>2,7</i></li></ul>
                <span className="lp-fake-btn">Preparar el taller de Derivadas</span></div>
            </div>
          </div>
        </article>

        <article className="lp-feature is-flipped">
          <div className="lp-feature-copy">
            <h2>Califica con rúbrica, un clic por criterio</h2>
            <p>La rúbrica sale del taller que guardaste, con cuatro niveles descritos por criterio. Eliges un nivel, la lista pasa sola al siguiente estudiante y las notas llegan al libro.</p>
          </div>
          <div className="lp-rubric" aria-hidden>
            <header><ClipboardCheck size={16} /><b>Justificación del procedimiento</b><span>40 %</span></header>
            <ol><li>Excelente<small>Explica cada paso y lo conecta con la definición.</small></li><li className="is-on">Bueno<small>Explica los pasos; falta una conexión menor.</small></li><li>Básico<small>Resuelve sin explicar por qué.</small></li><li>Insuficiente<small>No llega al resultado.</small></li></ol>
            <footer><span>Juan Pablo Castaño</span><b>4,0</b><em>sigue Mariana López</em></footer>
          </div>
        </article>

        <article className="lp-feature">
          <div className="lp-feature-copy">
            <h2>Un mapa para ver dónde reforzar</h2>
            <p>Cada estudiante cruzado con cada tema. Lo rojo es lo que hay que retomar; lo verde, lo que el grupo ya domina. De ahí sale el siguiente taller.</p>
          </div>
          <div className="lp-map" aria-hidden>
            <table className="heatmap"><thead><tr><th>Estudiante</th>{TOPICS.map(topic => <th key={topic}>{topic}</th>)}</tr></thead>
              <tbody>{ROWS.slice(0, 4).map(row => <tr key={row.name}><th>{row.name.split(' ')[0]}</th>{row.grades.map((v, i) => <td key={i} className={`heat heat-${v < 3 ? 'low' : v < 4 ? 'medium' : 'high'}`}>{grade(v)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="lp-trust" id="tus-datos" aria-labelledby="trust-title">
        <h2 id="trust-title">Tú tienes la última palabra</h2>
        <ul>
          <li><b>Nada se asigna solo.</b><span>Cada taller, quiz o rúbrica es un borrador que revisas y ajustas antes de usar.</span></li>
          <li><b>Los nombres se quedan en tu cuenta.</b><span>Para crear una actividad, la IA recibe tu material y un resumen del curso, sin nombres ni notas individuales.</span></li>
          <li><b>Cada curso por separado.</b><span>Tus listas y tus notas solo las ves tú, y puedes descargar un respaldo cuando quieras.</span></li>
        </ul>
      </section>

      <section className="lp-cta">
        <Owl pose="wave" size={132} />
        <div><h2>Empieza con el curso que tienes este semestre.</h2>
          <p>Crear la cuenta toma un minuto. Una guía te acompaña en los primeros pasos.</p>
          <div className="lp-actions"><button className="btn btn-primary btn-large" onClick={onRegister}>Crear cuenta gratis<ArrowRight size={18} aria-hidden /></button><button className="btn btn-secondary btn-large" onClick={onLogin}>Entrar</button></div>
        </div>
      </section>
    </main>

    <footer className="lp-foot"><FairTeamMark size={22} /><span className="wordmark" translate="no">FairTeam</span><span>Proyecto final de Patrones de diseño</span><a href="#como-funciona">Cómo funciona</a><button className="link-btn" onClick={onLogin}>Entrar</button></footer>
  </div>
}
