import { useState } from 'react'
import { Download, LogOut, RotateCw, Trash2 } from 'lucide-react'
import { API_BASE, request, type TeacherProfile } from '../api'
import type { PageProps } from '../App'
import { Segmented, Spinner, useFeedback } from '../components/ui'
import { saveTheme, storedTheme, type ThemePreference } from '../lib/theme'
import { canSpeak, setSpeechRate, speak, speechRate } from '../lib/speech'
import { downloadTemplate, downloadText } from '../lib/files'
import { plural } from '../lib/domain'
import { DemoButton } from '../components/DemoButton'
import { openGuide } from '../lib/guide'

export default function SettingsPage({ workspace, user, onLogout }: PageProps & { user: TeacherProfile; onLogout: () => void }) {
  const { notify, confirm } = useFeedback()
  const [checking, setChecking] = useState(false)
  const [theme, setTheme] = useState<ThemePreference>(storedTheme)
  const [rate, setRate] = useState(speechRate)
  const { course, students, grades, projects, teams, workshops } = workspace

  const check = async () => {
    setChecking(true)
    const started = performance.now()
    try {
      await request('/')
      notify(`Servidor conectado (${Math.round(performance.now() - started)} ms).`)
      await workspace.refreshAll()
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo conectar.', 'error') }
    finally { setChecking(false) }
  }
  const backup = () => {
    const data = { exportedAt: new Date().toISOString(), account: user.email, course: course?.name ?? null, students, grades, projects, teams, workshops }
    downloadText(`fairteam-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
    notify('Respaldo descargado.')
  }
  const clear = async () => {
    if (!workshops.length) return notify('No hay propuestas guardadas en este curso.', 'info')
    if (await confirm({ title: '¿Vaciar la biblioteca de este curso?', body: `Se borrarán ${plural(workshops.length, 'propuesta', 'propuestas')} guardadas en este curso. Las rúbricas se conservan.`, confirm: 'Vaciar biblioteca', danger: true })) { await workspace.clearWorkshops(); notify('Biblioteca vaciada.') }
  }

  return <section className="page page-narrow">
    <header className="page-head"><div><h1>Ajustes</h1><p>Tu cuenta, la conexión y tus datos.</p></div></header>

    <section className="panel settings">
      <h2>Cuenta</h2>
      <dl className="rows"><div><dt>Nombre</dt><dd>{user.name}</dd></div><div><dt>Correo</dt><dd>{user.email}</dd></div><div><dt>Rol</dt><dd>{user.role || 'Docente'}</dd></div></dl>
      <button className="btn btn-secondary" onClick={onLogout}><LogOut size={16} aria-hidden />Cerrar sesión</button>
    </section>

    <section className="panel settings">
      <h2>Ayuda</h2>
      <p className="muted">"Primeros pasos" te acompaña mientras haces cada cosa; el recorrido rápido solo te muestra las secciones.</p>
      <div className="button-row">
        <button className="btn btn-primary" data-tour="tutorial" onClick={openGuide}>Primeros pasos</button>
        <button className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event('fairteam:tour'))}>Recorrido rápido</button>
        <button className="btn btn-ghost" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}>Atajos de teclado</button>
      </div>
    </section>

    <section className="panel settings">
      <h2>Apariencia</h2>
      <Segmented label="Tema" value={theme} onChange={value => { setTheme(value); saveTheme(value) }} options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Como el sistema' }]} />
      <p className="muted">El modo oscuro descansa la vista al revisar notas de noche.</p>
    </section>

    {canSpeak() && <section className="panel settings">
      <h2>Voz del Búho</h2>
      <label className="field">
        <span className="field-label">Velocidad <span className="muted num">{rate.toFixed(2).replace('.', ',')}×</span></span>
        <input type="range" className="range" min={0.8} max={1.3} step={0.05} value={rate} onChange={event => { const value = Number(event.target.value); setRate(value); setSpeechRate(value) }} />
      </label>
      <button className="btn btn-secondary" onClick={() => speak('Hola, soy el Búho. Así sueno a esta velocidad.')}>Probar la voz</button>
    </section>}

    <section className="panel settings">
      <h2>Conexión</h2>
      <dl className="rows"><div><dt>Servidor</dt><dd><code>{API_BASE.replace(/^https?:\/\//, '')}</code></dd></div></dl>
      <p className="muted">El servidor gratuito se duerme tras 15 minutos sin uso; la primera acción puede tardar hasta un minuto.</p>
      <button className="btn btn-secondary" onClick={() => void check()} disabled={checking}>{checking ? <Spinner /> : <RotateCw size={16} aria-hidden />}{checking ? 'Comprobando…' : 'Comprobar y actualizar datos'}</button>
    </section>

    <section className="panel settings">
      <h2>Tus datos</h2>
      <dl className="rows">
        <div><dt>Curso abierto</dt><dd>{course?.name ?? '—'}</dd></div>
        <div><dt>Estudiantes y notas</dt><dd className="num">{students.length} · {grades.length}</dd></div>
        <div><dt>Propuestas guardadas</dt><dd className="num">{workshops.length}</dd></div>
      </dl>
      <div className="button-row">
        <button className="btn btn-secondary" onClick={backup}><Download size={16} aria-hidden />Descargar respaldo</button>
        <button className="btn btn-ghost" onClick={() => void downloadTemplate('roster', 'xlsx')}><Download size={16} aria-hidden />Plantilla de lista</button>
        <button className="btn btn-ghost" onClick={() => void downloadTemplate('grades', 'xlsx')}><Download size={16} aria-hidden />Plantilla de notas</button>
      </div>
      <p className="muted">¿Vas a presentar FairTeam? Carga cuatro cursos ficticios de varios semestres para mostrar todas las funciones.</p>
      <div className="button-row"><DemoButton onLoaded={workspace.loadCourses} variant="btn-ghost" /></div>
      <button className="btn btn-ghost btn-danger-text" onClick={() => void clear()} disabled={!workshops.length}><Trash2 size={16} aria-hidden />Vaciar biblioteca de este curso</button>
    </section>
  </section>
}
