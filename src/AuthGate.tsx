import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { clearAccessToken, request, saveAccessToken, TOKEN_KEY, warmUpBackend, type AuthResponse, type TeacherProfile } from './api'
import FairTeamMark from './FairTeamMark'
import Owl from './components/Owl'
import LandingPage from './LandingPage'
import { FeedbackProvider, Spinner } from './components/ui'

const App = lazy(() => import('./App'))
type Mode = 'home' | 'login' | 'register'

export default function AuthGate() {
  const [user, setUser] = useState<TeacherProfile | null>(null)
  const [checking, setChecking] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)))
  const [mode, setMode] = useState<Mode>(() => window.location.hash === '#/entrar' ? 'login' : window.location.hash === '#/registro' ? 'register' : 'home')

  useEffect(() => {
    warmUpBackend()
    if (!sessionStorage.getItem(TOKEN_KEY)) return
    void request<TeacherProfile>('/api/auth/me').then(setUser).catch(() => clearAccessToken()).finally(() => setChecking(false))
  }, [])
  useEffect(() => { if (!user) import('./App') }, [user]) // prefetch the app while the teacher reads or types

  const logout = () => { clearAccessToken(); setUser(null); setMode('login'); window.location.hash = '' }

  if (checking) return <div className="boot"><FairTeamMark size={44} /><span><Spinner /> Abriendo tu espacio…</span></div>
  if (user) return <FeedbackProvider><Suspense fallback={<div className="boot"><FairTeamMark size={44} /><span><Spinner /> Abriendo tu espacio…</span></div>}><App user={user} onLogout={logout} /></Suspense></FeedbackProvider>
  if (mode === 'home') return <LandingPage onLogin={() => setMode('login')} onRegister={() => setMode('register')} />
  return <AuthScreen mode={mode} setMode={setMode} onAuthenticated={setUser} />
}

function AuthScreen({ mode, setMode, onAuthenticated }: { mode: 'login' | 'register'; setMode: (mode: Mode) => void; onAuthenticated: (user: TeacherProfile) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [working, setWorking] = useState(false)
  const [slow, setSlow] = useState(false)
  const [message, setMessage] = useState('')
  const isLogin = mode === 'login'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setWorking(true); setSlow(false); setMessage('')
    const timer = window.setTimeout(() => setSlow(true), 6000)
    try {
      const result = await request<AuthResponse>(isLogin ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(isLogin ? { email: email.trim(), password } : { name: name.trim(), email: email.trim(), password }),
      })
      saveAccessToken(result.accessToken)
      window.location.hash = '#/inicio'
      onAuthenticated({ id: result.id, name: result.name, email: result.email, role: result.role })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo entrar. Inténtalo de nuevo.')
    } finally { window.clearTimeout(timer); setWorking(false); setSlow(false) }
  }

  return <main className="auth">
    <section className="auth-card" aria-labelledby="auth-title">
      <button className="link-btn auth-back" onClick={() => setMode('home')}><ArrowLeft size={16} aria-hidden />Volver</button>
      <div className="auth-brand"><FairTeamMark size={40} /><span className="wordmark" translate="no">FairTeam</span></div>
      <h1 id="auth-title">{isLogin ? 'Qué bueno verte de nuevo.' : 'Crea tu cuenta docente.'}</h1>
      <p className="auth-sub">{isLogin ? 'Entra para ver cómo van tus cursos.' : 'Gratis. Tus cursos y estudiantes quedan solo en tu cuenta.'}</p>
      <form className="form" onSubmit={submit} noValidate={false}>
        {!isLogin && <label className="field"><span className="field-label">Nombre completo</span><input name="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={120} disabled={working} placeholder="Ej. Ana María Torres…" /></label>}
        <label className="field"><span className="field-label">Correo</span><input name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={180} disabled={working} spellCheck={false} placeholder="tu@universidad.edu.co" /></label>
        <label className="field"><span className="field-label">Contraseña</span>
          <span className="password">
            <input name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={isLogin ? 1 : 10} maxLength={72} disabled={working} />
            <button type="button" className="icon-btn" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </span>
          {!isLogin && <span className="field-hint">Mínimo 10 caracteres.</span>}
        </label>
        {message && <div className="form-error" role="alert">{message}</div>}
        {slow && <div className="form-note" role="status">El servidor se está despertando; puede tardar hasta un minuto. No cierres la página.</div>}
        <button className="btn btn-primary btn-large" disabled={working}>{working && <Spinner />}{working ? (slow ? 'Despertando el servidor…' : 'Entrando…') : isLogin ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <p className="auth-switch">{isLogin ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'} <button className="link-btn" disabled={working} onClick={() => { setMode(isLogin ? 'register' : 'login'); setMessage('') }}>{isLogin ? 'Créala aquí' : 'Entra aquí'}</button></p>
    </section>
    <aside className="auth-aside">
      <div className="auth-owl" aria-hidden><Owl pose="wave" size={300} /></div>
      <ul className="auth-points">
        <li><b>Quién necesita apoyo</b><span>Lo calculo con tus notas, al instante.</span></li>
        <li><b>Talleres desde tu material</b><span>Listos para revisar, imprimir o descargar.</span></li>
        <li><b>Tú decides</b><span>Nada se asigna ni se envía sin ti.</span></li>
      </ul>
    </aside>
  </main>
}
