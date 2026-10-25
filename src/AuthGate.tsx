import { useEffect, useState, type FormEvent } from 'react'
import { Activity, ArrowRight, BookOpenCheck, BrainCircuit, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'
import App from './App'
import LandingPage from './LandingPage'
import { clearAccessToken, request, saveAccessToken, type AuthResponse, type TeacherProfile } from './api'
import FairTeamMark from './FairTeamMark'

type Mode = 'home' | 'login' | 'register'

export default function AuthGate() {
  const [user, setUser] = useState<TeacherProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<Mode>('home')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [waitingForServer, setWaitingForServer] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = sessionStorage.getItem('fairteam.accessToken')
    if (!token) { setChecking(false); return }
    void request<TeacherProfile>('/api/auth/me').then(setUser).catch(() => clearAccessToken()).finally(() => setChecking(false))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setWorking(true)
    setWaitingForServer(false)
    setMessage('')
    const slowRequestTimer = window.setTimeout(() => setWaitingForServer(true), 12_000)
    try {
      const result = await request<AuthResponse>(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }),
      })
      saveAccessToken(result.accessToken)
      setUser({ id: result.id, name: result.name, email: result.email, role: result.role })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar el acceso. Inténtalo de nuevo.')
    } finally {
      window.clearTimeout(slowRequestTimer)
      setWorking(false)
      setWaitingForServer(false)
    }
  }

  const logout = () => { clearAccessToken(); setUser(null); setPassword(''); setMode('login') }
  if (user) return <App user={user} onLogout={logout} />
  if (checking) return <main className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={25} /> Verificando tu sesión…</div></main>
  if (mode === 'home') return <LandingPage onLogin={() => setMode('login')} onRegister={() => setMode('register')} />

  return <main className="auth-screen teacher-auth-screen" onPointerMove={event => {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    event.currentTarget.style.setProperty('--parallax-x', `${x * 28}px`)
    event.currentTarget.style.setProperty('--parallax-y', `${y * 22}px`)
  }} onPointerLeave={event => {
    event.currentTarget.style.setProperty('--parallax-x', '0px')
    event.currentTarget.style.setProperty('--parallax-y', '0px')
  }}>
    <div className="auth-backdrop auth-backdrop-one" /><div className="auth-backdrop auth-backdrop-two" />
    <div className="auth-frame">
      <section className="auth-side-copy teacher-auth-story">
        <div className="auth-side-kicker">FAIRTEAM · ASISTENTE DOCENTE</div>
        <h2>Más claridad para acompañar cada aprendizaje.</h2>
        <p>Revisa el progreso del curso, encuentra señales que requieren atención y prepara actividades basadas en el material de clase.</p>
        <div className="auth-feature-stack"><div><span><Activity size={17} /></span><b>Señales rápidas y explicables</b></div><div><span><BrainCircuit size={17} /></span><b>Refuerzo con IA cuando tú lo pides</b></div><div><span><BookOpenCheck size={17} /></span><b>El docente conserva la decisión</b></div></div>
        <div className="auth-floating-note"><Sparkles size={15} /> Primero los datos, luego la recomendación.</div>
      </section>
      <section className="auth-card teacher-auth-card">
        <div className="auth-brand"><span className="auth-brand-mark"><FairTeamMark size={42} /></span><span>fair<span>team</span><sup>✳</sup></span></div>
        <div className="auth-eyebrow"><LockKeyhole size={14} /> ESPACIO DOCENTE</div>
        <h1>{mode === 'login' ? 'Qué bueno verte.' : 'Crea tu cuenta docente.'}</h1>
        <p className="auth-copy">{mode === 'login' ? 'Inicia sesión para continuar con el seguimiento de tu curso.' : 'Crea tu espacio docente personal. Tus estudiantes y notas estarán separados de otras cuentas.'}</p>
        <form className="teacher-auth-form" onSubmit={submit}>
          {mode === 'register' && <label>Nombre completo<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required disabled={working} minLength={2} maxLength={120} placeholder="Tu nombre" /></label>}
          <label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required disabled={working} maxLength={180} placeholder="profe@institucion.edu" /></label>
          <label>Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required disabled={working} minLength={mode === 'register' ? 10 : 1} maxLength={72} placeholder={mode === 'register' ? 'Mínimo 10 caracteres' : 'Tu contraseña'} /></label>
          {message && <div className="auth-message" role="alert">{message}</div>}
          {working && waitingForServer && <div className="auth-wait-note" role="status">Render puede tardar hasta un minuto en despertar. La solicitud sigue activa; si agota el tiempo, podrás volver a intentarlo.</div>}
          <button className="google-login teacher-auth-submit" type="submit" disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />}{working ? waitingForServer ? 'Despertando servidor…' : 'Conectando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}<ArrowRight size={17} /></button>
        </form>
        <button className="auth-mode-switch" disabled={working} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? '¿Aún no tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button>
        <button className="auth-home-switch" disabled={working} onClick={() => { setMode('home'); setMessage('') }}>← Volver a conocer FairTeam</button>
      </section>
    </div>
    <div className="auth-copyright">FAIRTEAM <span>·</span> SEGUIMIENTO Y REFUERZO DEL APRENDIZAJE</div>
  </main>
}
