import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { ArrowRight, BookOpenCheck, GraduationCap, LoaderCircle, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import App from './App'
import { firebaseAuth, firebaseConfigured, googleProvider } from './auth'
import { API_BASE } from './api'

const localPreview = import.meta.env.DEV

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(firebaseConfigured)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)

  const verifyAccess = async (account: User) => {
    setChecking(true)
    try {
      const token = await account.getIdToken(true)
      const response = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      if (!response.ok) throw new Error(response.status === 403
        ? 'Esta cuenta de Google no tiene acceso docente habilitado. Usa el correo autorizado por tu institución.'
        : 'No se pudo validar el acceso docente. Confirma la configuración de autenticación del backend e inténtalo de nuevo.')
      setUser(account)
      setAccessDenied(false)
      setMessage('')
    } catch (error) {
      setUser(account)
      setAccessDenied(true)
      setMessage(error instanceof Error ? error.message : 'No se pudo verificar esta cuenta.')
    } finally { setChecking(false); setWorking(false) }
  }

  useEffect(() => {
    if (!firebaseAuth) return
    return onAuthStateChanged(firebaseAuth, nextUser => {
      if (!nextUser) {
        setUser(null)
        setAccessDenied(false)
        setChecking(false)
        return
      }
      void verifyAccess(nextUser)
    })
  }, [])

  const login = async () => {
    if (!firebaseAuth) return
    setWorking(true)
    setMessage('')
    try {
      await signInWithPopup(firebaseAuth, googleProvider)
    } catch (error) {
      const authError = error as { code?: string; message?: string }
      if (authError.code === 'auth/popup-blocked') {
        try { await signInWithRedirect(firebaseAuth, googleProvider) }
        catch { setMessage('No fue posible abrir Google. Permite las ventanas emergentes e inténtalo nuevamente.'); setWorking(false) }
      } else {
        setMessage(authError.code === 'auth/unauthorized-domain'
          ? 'Este dominio aún no está autorizado en Firebase Authentication.'
          : 'No pudimos iniciar sesión con Google. Inténtalo nuevamente.')
        setWorking(false)
      }
    }
  }

  const logout = async () => {
    if (!firebaseAuth) return
    await signOut(firebaseAuth)
    setAccessDenied(false)
    setMessage('')
  }

  if (user && !accessDenied) return <App user={user} onLogout={() => void logout()} />
  if (localPreview && !firebaseConfigured) return <App user={null} onLogout={() => undefined} />

  if (!firebaseConfigured) return <AuthShell>
    <div className="auth-card">
      <Brand />
      <div className="auth-orbit"><div className="auth-orbit-icon"><Users size={29} /></div><span className="auth-float auth-float-a"><GraduationCap size={18} /></span><span className="auth-float auth-float-b"><BookOpenCheck size={17} /></span></div>
      <div className="auth-eyebrow"><LockKeyhole size={14} /> ACCESO DOCENTE SEGURO</div>
      <h1>Un aula más equilibrada empieza aquí.</h1>
      <p className="auth-copy">FairTeam reúne el progreso de tus estudiantes, organiza equipos diversos y crea experiencias de refuerzo para acompañar cada aprendizaje.</p>
      <div className="auth-benefits"><span><ShieldCheck size={16} /> Información académica protegida</span><span><Users size={16} /> Equipos con fortalezas diversas</span><span><BookOpenCheck size={16} /> Talleres de aprendizaje personalizados</span></div>
      <div className="auth-setup-note"><strong>Falta conectar Firebase</strong><span>Configura las variables de Firebase en Render para activar el inicio de sesión con Google. La guía está en el README del proyecto.</span></div>
    </div>
  </AuthShell>

  if (checking) return <AuthShell><div className="auth-loading"><LoaderCircle className="spin" size={25} /> Verificando sesión segura…</div></AuthShell>

  return <AuthShell>
    <div className="auth-card">
      <Brand />
      <div className="auth-orbit"><div className="auth-orbit-icon"><Users size={29} /></div><span className="auth-float auth-float-a"><GraduationCap size={18} /></span><span className="auth-float auth-float-b"><BookOpenCheck size={17} /></span></div>
      <div className="auth-eyebrow"><LockKeyhole size={14} /> ACCESO DOCENTE SEGURO</div>
      <h1>Un aula más equilibrada empieza aquí.</h1>
      <p className="auth-copy">Inicia sesión para revisar el progreso, crear equipos diversos y preparar talleres para tu grupo.</p>
      <button className="google-login" onClick={() => void login()} disabled={working}><GoogleMark />{working ? 'Conectando con Google…' : 'Continuar con Google'}<ArrowRight size={17} /></button>
      {message && <div className="auth-message" role="alert">{message}</div>}
      {accessDenied && user && <button className="auth-retry" onClick={() => void verifyAccess(user)}>Reintentar validación</button>}
      <div className="auth-secure"><ShieldCheck size={16} /><span>El acceso se valida en el servidor. Solo las cuentas docentes autorizadas pueden consultar información.</span></div>
      <div className="auth-footnote">Al continuar, usarás tu cuenta institucional de Google.</div>
    </div>
  </AuthShell>
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className="auth-screen"><div className="auth-backdrop auth-backdrop-one" /><div className="auth-backdrop auth-backdrop-two" /><div className="auth-frame"><div className="auth-side-copy"><div className="auth-side-kicker">APRENDER JUNTOS, CRECER JUNTOS</div><h2>Cada estudiante aporta algo único.</h2><p>Cuando conocemos sus fortalezas, podemos crear equipos donde todos tengan la oportunidad de avanzar.</p><div className="auth-stat-row"><div><strong>01</strong><span>Observa el progreso</span></div><div><strong>02</strong><span>Equilibra los equipos</span></div><div><strong>03</strong><span>Acompaña el aprendizaje</span></div></div></div>{children}</div><div className="auth-copyright">FAIRTEAM <span>·</span> HERRAMIENTA DE ACOMPAÑAMIENTO DOCENTE</div></main>
}

function Brand() { return <div className="auth-brand"><span className="auth-brand-mark"><Users size={20} /></span><span>fair<span>team</span><sup>✳</sup></span></div> }
function GoogleMark() { return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5.1h6.7c3.9-3.6 6-8.8 6-14.8Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.3C9.1 39.5 16 44 24 44Z"/><path fill="#4A90E2" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.7a20 20 0 0 0 0 17.8l6.9-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4 16 4 9.1 8.5 5.7 15.1l6.9 5.3C14.2 15.6 18.7 12 24 12Z"/></svg> }
