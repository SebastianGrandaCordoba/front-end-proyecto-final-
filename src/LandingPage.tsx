import { useEffect } from 'react'
import { ArrowDown, ArrowRight, BarChart3, BookOpenCheck, Check, ChevronRight, CircleHelp, FileSpreadsheet, FolderOpen, LockKeyhole, MessageCircle, Sparkles, Target, WandSparkles } from 'lucide-react'
import FairTeamMark from './FairTeamMark'
import FairTeamOwl from './FairTeamOwl'

type LandingPageProps = { onLogin: () => void; onRegister: () => void }

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  useEffect(() => {
    const revealTargets = document.querySelectorAll<HTMLElement>(
      '.landing-section-heading, .landing-feature-card, .landing-assistant-copy, .landing-chat-card, .landing-steps article, .landing-final-cta, .landing-footer',
    )
    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach(target => target.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.14, rootMargin: '0px 0px -36px 0px' })
    revealTargets.forEach((target, index) => {
      target.classList.add('scroll-reveal')
      target.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 85}ms`)
      observer.observe(target)
    })
    return () => observer.disconnect()
  }, [])

  return <main className="landing-page">
    <header className="landing-nav">
      <a className="landing-brand" href="#inicio" aria-label="FairTeam, inicio"><FairTeamMark size={42}/><span>fair<span>team</span><sup>✳</sup></span></a>
      <nav aria-label="Navegación del sitio"><a href="#como-ayuda">Qué hace</a><a href="#flujo">Cómo funciona</a><a href="#docente">Para docentes</a></nav>
      <div className="landing-nav-actions"><button className="landing-login" onClick={onLogin}>Iniciar sesión</button><button className="landing-nav-cta" onClick={onRegister}>Crear cuenta <ArrowRight size={15}/></button></div>
    </header>

    <section className="landing-hero" id="inicio">
      <div className="landing-hero-copy">
        <div className="landing-kicker"><span className="landing-kicker-icon"><Sparkles size={14}/></span> ASISTENTE DOCENTE CON CONTEXTO</div>
        <h1>Más claridad para acompañar <span>cada aprendizaje.</span></h1>
        <p className="landing-hero-text">FairTeam te ayuda a entender cómo avanza tu curso, reconocer quién puede necesitar apoyo y convertir tus materiales en actividades de refuerzo.</p>
        <div className="landing-hero-actions"><button className="landing-primary" onClick={onRegister}>Empieza con tu curso <ArrowRight size={17}/></button><a className="landing-secondary" href="#como-ayuda"><span><ArrowDown size={15}/></span> Conoce FairTeam</a></div>
        <div className="landing-trust-line"><LockKeyhole size={14}/> Tus cursos y estudiantes permanecen en tu espacio docente.</div>
      </div>
      <div className="landing-hero-visual" aria-label="Vista ilustrativa del asistente docente FairTeam">
        <div className="landing-visual-glow"/>
        <div className="landing-visual-topline"><span><i/> ASISTENTE DE CURSO</span><span className="landing-demo-badge">VISTA DE EJEMPLO</span></div>
        <div className="landing-course-peek"><span className="landing-peek-icon"><FolderOpen size={16}/></span><div><b>Patrones de software</b><small>Curso · Seguimiento del aprendizaje</small></div><ChevronRight size={16}/></div>
        <FairTeamOwl/>
        <div className="landing-insight-card"><span className="landing-insight-icon"><BarChart3 size={16}/></span><div><small>SEÑAL PARA REVISAR</small><b>Un tema necesita más práctica</b><span>Revisa las notas y el material del curso</span></div><ArrowRight size={15}/></div>
        <span className="landing-visual-caption">Ilustración y datos de ejemplo</span>
      </div>
      <div className="landing-hero-bottom"><span>UN ASISTENTE QUE PARTE DE TU CURSO</span><span className="landing-bottom-line"/><a href="#como-ayuda">Descubre cómo ayuda <ArrowDown size={14}/></a></div>
    </section>

    <section className="landing-section landing-workflow" id="como-ayuda">
      <div className="landing-section-heading"><div><span className="landing-overline">DEL PANORAMA A LA ACCIÓN</span><h2>Tu curso tiene una historia.<br/><em>Encuentra el siguiente paso.</em></h2></div><p>Una mirada organizada al rendimiento, junto con herramientas para responder a lo que observas en clase.</p></div>
      <div className="landing-feature-grid">
        <article className="landing-feature-card landing-feature-wide">
          <div className="landing-feature-top"><span className="landing-feature-icon icon-blue"><FileSpreadsheet size={19}/></span><span className="landing-feature-number">01 / ORGANIZA</span></div>
          <h3>Un espacio para cada curso</h3><p>Separa tus grupos y conserva en contexto sus estudiantes, calificaciones, materiales y actividades.</p>
          <div className="landing-mini-course-list"><div><span className="landing-mini-folder"><FolderOpen size={16}/></span><span><b>Patrones de software</b><small>4.º semestre · Grupo A</small></span><span className="landing-mini-arrow"><ChevronRight size={15}/></span></div><div><span className="landing-mini-folder"><FolderOpen size={16}/></span><span><b>Estructuras de datos</b><small>2.º semestre · Grupo B</small></span><span className="landing-mini-arrow"><ChevronRight size={15}/></span></div></div>
        </article>
        <article className="landing-feature-card landing-feature-data">
          <div className="landing-feature-top"><span className="landing-feature-icon icon-violet"><BarChart3 size={19}/></span><span className="landing-feature-number">02 / COMPRENDE</span></div>
          <h3>Señales fáciles de revisar</h3><p>Importa una hoja de notas y encuentra promedios, cambios y estudiantes que podrían beneficiarse de seguimiento.</p>
          <div className="landing-signal-preview"><span className="landing-signal-dot"/><span><b>Revisión sugerida</b><small>Consulta las calificaciones antes de decidir</small></span><span className="landing-signal-badge">NOTAS</span></div>
        </article>
        <article className="landing-feature-card landing-feature-ai">
          <div className="landing-feature-top"><span className="landing-feature-icon icon-indigo"><WandSparkles size={19}/></span><span className="landing-feature-number">03 / PREPARA</span></div>
          <h3>Refuerzo a partir de tu material</h3><p>Sube lo que enseñas y prepara con IA un taller o quiz conectado con el tema y el nivel que quieres apoyar.</p>
          <div className="landing-ai-preview"><span><BookOpenCheck size={15}/></span><b>Guía de práctica</b><small>Objetivos · actividades · comprobación</small><Check size={15}/></div>
        </article>
      </div>
    </section>

    <section className="landing-assistant-band" id="flujo">
      <div className="landing-assistant-copy"><span className="landing-overline">PREGUNTA. REVISA. DECIDE.</span><h2>Una ayuda inteligente.<br/><em>La decisión sigue siendo tuya.</em></h2><p>Consulta el panorama de tu grupo y usa las recomendaciones como punto de partida. FairTeam muestra el contexto disponible para que el docente revise qué conviene hacer.</p><ul><li><span><Check size={13}/></span>Recomendaciones vinculadas con notas y materiales cargados</li><li><span><Check size={13}/></span>Actividades editables y listas para revisar</li><li><span><Check size={13}/></span>El profesor decide qué usar y cómo acompañar</li></ul><button className="landing-text-link" onClick={onRegister}>Crea tu espacio docente <ArrowRight size={16}/></button></div>
      <div className="landing-chat-card"><div className="landing-chat-head"><FairTeamMark size={34}/><span><b>FairTeam</b><small>Asistente del curso</small></span><span className="landing-chat-online"><i/> LISTO PARA AYUDAR</span></div><div className="landing-chat-user"><span>¿Qué tema conviene reforzar con este grupo?</span><small>En el curso seleccionado</small></div><div className="landing-chat-answer"><span className="landing-chat-spark"><Sparkles size={14}/></span><div><b>Podemos revisar la evidencia del curso</b><p>FairTeam puede resumir las calificaciones cargadas y relacionarlas con el material disponible. Revisa la señal y decide si quieres preparar una actividad.</p><button onClick={onLogin}>Abrir mi espacio <ArrowRight size={13}/></button></div></div><div className="landing-chat-composer"><MessageCircle size={16}/><span>Pregunta sobre el curso…</span><span><ArrowRight size={15}/></span></div><div className="landing-chat-disclaimer"><CircleHelp size={12}/> La respuesta depende de los datos que proporciones.</div></div>
    </section>

    <section className="landing-steps" id="docente"><div className="landing-section-heading landing-steps-heading"><div><span className="landing-overline">EMPIEZA CON LO QUE YA TIENES</span><h2>De tu material a una<br/><em>acción de aprendizaje.</em></h2></div><p>Un flujo breve para que puedas pasar de las notas y el contenido de clase a una propuesta que revisar.</p></div><div className="landing-step-row"><article><span className="landing-step-index">01</span><div className="landing-step-icon"><FolderOpen size={20}/></div><h3>Crea tu curso</h3><p>Organiza cada grupo en su propio espacio privado.</p></article><span className="landing-step-connector"/><article><span className="landing-step-index">02</span><div className="landing-step-icon"><FileSpreadsheet size={20}/></div><h3>Agrega el contexto</h3><p>Importa estudiantes y calificaciones; sube el material de estudio.</p></article><span className="landing-step-connector"/><article><span className="landing-step-index">03</span><div className="landing-step-icon"><Target size={20}/></div><h3>Revisa y acompaña</h3><p>Explora señales y genera una actividad para revisar con tu grupo.</p></article></div></section>

    <section className="landing-final-cta"><div className="landing-cta-owl"><FairTeamMark size={58}/><span>¡Hola, profe!</span></div><div><span className="landing-overline">UN ESPACIO DOCENTE, A TU MANERA</span><h2>Empieza por un curso.<br/>FairTeam te ayuda a ver el resto.</h2><p>Tu cuenta es privada y los datos de tus cursos permanecen separados.</p></div><button onClick={onRegister}>Crear mi cuenta <ArrowRight size={17}/></button><Sparkles className="landing-cta-spark" size={22}/></section>

    <footer className="landing-footer"><a className="landing-brand" href="#inicio"><FairTeamMark size={34}/><span>fair<span>team</span><sup>✳</sup></span></a><span>Un asistente docente para acompañar el aprendizaje.</span><div><button onClick={onLogin}>Iniciar sesión</button><a href="#como-ayuda">Qué hace FairTeam</a></div><small>© {new Date().getFullYear()} FairTeam</small></footer>
  </main>
}
