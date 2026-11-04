import { ArrowRight, Check, FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react'
import FairTeamMark from './FairTeamMark'
import FairTeamOwl from './FairTeamOwl'
import Owl from './components/Owl'

type Props = { onLogin: () => void; onRegister: () => void }

export default function LandingPage({ onLogin, onRegister }: Props) {
  return <div className="landing">
    <header className="landing-nav">
      <a className="landing-brand" href="#" aria-label="FairTeam, inicio"><FairTeamMark size={34} /><span className="wordmark" translate="no">FairTeam</span></a>
      <nav aria-label="Secciones"><a href="#como-funciona">Cómo funciona</a><a href="#tu-decides">Tú decides</a></nav>
      <div className="landing-nav-actions"><button className="btn btn-ghost" onClick={onLogin}>Entrar</button><button className="btn btn-primary" onClick={onRegister}>Crear cuenta</button></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <h1>Sabe a quién apoyar en cada clase.</h1>
          <p>FairTeam es un asistente para profesores. Lee las notas de tu curso, te dice quién necesita refuerzo y en qué tema, y te deja el taller o el quiz listo con tu propio material.</p>
          <div className="hero-actions"><button className="btn btn-primary btn-large" onClick={onRegister}>Empezar gratis<ArrowRight size={18} aria-hidden /></button><button className="btn btn-secondary btn-large" onClick={onLogin}>Ya tengo cuenta</button></div>
          <ul className="hero-proof"><li><Check size={16} aria-hidden />Importa tu Excel tal como lo tienes</li><li><Check size={16} aria-hidden />Cada curso por separado</li></ul>
        </div>
        <div className="hero-visual">
          <div className="hero-owl" aria-hidden><FairTeamOwl /></div>
          <div className="hero-card" aria-label="Ejemplo de recomendación del asistente">
            <span className="hero-card-tag">Ejemplo · Programación I</span>
            <b>Prepara un refuerzo para 4 estudiantes</b>
            <p>Ciclos y condicionales tiene el promedio más bajo: 2,7 de 5.</p>
            <span className="hero-card-btn"><Sparkles size={15} aria-hidden />Preparar taller</span>
          </div>
        </div>
      </section>

      <section className="how" id="como-funciona" aria-labelledby="how-title">
        <h2 id="how-title">Tres pasos, sin manuales</h2>
        <ol>
          <li><span className="how-n">1</span><Owl pose="read" size={92} className="how-owl" /><FileSpreadsheet size={22} aria-hidden /><h3>Sube la lista y las notas</h3><p>Desde Excel o CSV. Reconozco columnas como Nombre, Materia, Nota y Periodo.</p></li>
          <li><span className="how-n">2</span><Owl pose="think" size={92} className="how-owl" /><Sparkles size={22} aria-hidden /><h3>Mira lo que te recomiendo</h3><p>Quién está por debajo de 3,0, qué tema cuesta más y qué hacer primero, con la razón a la vista.</p></li>
          <li><span className="how-n">3</span><Owl pose="celebrate" size={92} className="how-owl" /><ArrowRight size={22} aria-hidden /><h3>Crea el taller o el quiz</h3><p>Elige tu material y el nivel. Recibes objetivos, actividades y preguntas con su clave, listos para imprimir.</p></li>
        </ol>
      </section>

      <section className="peek" aria-labelledby="peek-title">
        <div className="peek-copy">
          <h2 id="peek-title">Un vistazo y sabes dónde reforzar</h2>
          <p>El mapa por tema cruza a cada estudiante con cada tema. Lo rojo es lo que necesita refuerzo; lo verde, lo que ya dominan.</p>
          <p className="peek-note">Ejemplo con datos ficticios</p>
        </div>
        <div className="peek-frame" data-ui aria-hidden>
          <table className="heatmap"><thead><tr><th>Estudiante</th><th>Ciclos</th><th>Funciones</th><th>Arreglos</th></tr></thead>
            <tbody>{([['Valentina', 1.6, 2.1, 2.4], ['Santiago', 3.4, 3.9, 3.6], ['Mariana', 2.6, 3.1, 2.9], ['Juan Pablo', 4.4, 4.8, 4.6]] as const).map(([name, ...values]) => <tr key={name}><th>{name}</th>{values.map((v, i) => <td key={i} className={`heat heat-${v < 3 ? 'low' : v < 4 ? 'medium' : 'high'}`}>{v.toFixed(1).replace('.', ',')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="decide" id="tu-decides" aria-labelledby="decide-title">
        <div><ShieldCheck size={28} aria-hidden /><h2 id="decide-title">Tú tienes la última palabra</h2></div>
        <ul>
          <li><b>Nada se asigna solo.</b> Cada propuesta es un borrador que revisas antes de usar.</li>
          <li><b>La IA no ve a tus estudiantes.</b> Solo recibe el material y un resumen del curso, sin nombres ni notas.</li>
          <li><b>Tus datos son tuyos.</b> Cada cuenta y cada curso están separados.</li>
        </ul>
      </section>

      <section className="final-cta">
        <h2>Tu próximo curso, más claro desde el primer día.</h2>
        <button className="btn btn-primary btn-large" onClick={onRegister}>Crear mi cuenta<ArrowRight size={18} aria-hidden /></button>
      </section>
    </main>

    <footer className="landing-foot"><FairTeamMark size={22} /><span translate="no">FairTeam</span><span>Proyecto final · Patrones de diseño</span></footer>
  </div>
}
