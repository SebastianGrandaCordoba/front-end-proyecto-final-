import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BookOpen, Database, GraduationCap, RefreshCw, Search, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react'
import { request, type TeacherProfile } from '../api'
import { Avatar, EmptyState, Segmented, Spinner, useFeedback } from '../components/ui'
import { useCountUp } from '../lib/motion'
import { formatInt } from '../lib/domain'
import {
  actionLabel, filterAccounts, lastSeen,
  type AccountFilter, type AdminAccount, type AdminAuditRow, type AdminOverview, type AdminSystem,
} from '../lib/admin'
import { AccountDialog } from './admin/AccountDialog'

type Tab = 'accounts' | 'activity'

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) {
  const shown = useCountUp(value)
  return <div className="stat">
    <dt><span className="stat-icon" aria-hidden>{icon}</span>{label}</dt>
    <dd className="num">{formatInt(Math.round(shown ?? value))}</dd>
    <span>{note}</span>
  </div>
}

/** Sign-ups over the last 14 days as plain bars; the number is in the label for screen readers. */
function Signups({ days }: { days: AdminOverview['signupsByDay'] }) {
  const max = Math.max(1, ...days.map(day => day.signups))
  return <figure className="admin-signups">
    <figcaption>Cuentas nuevas, últimos 14 días</figcaption>
    <div role="img" aria-label={`Cuentas nuevas por día: ${days.map(d => `${d.day} ${d.signups}`).join(', ')}`}>
      {days.map(day => <span key={day.day} title={`${day.day}: ${day.signups}`} style={{ height: `${Math.max(4, (day.signups / max) * 100)}%` }} className={day.signups ? 'has' : ''} />)}
    </div>
  </figure>
}

export default function AdminPage({ user }: { user: TeacherProfile }) {
  const { notify } = useFeedback()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null)
  const [audit, setAudit] = useState<AdminAuditRow[] | null>(null)
  const [system, setSystem] = useState<AdminSystem | null>(null)
  const [tab, setTab] = useState<Tab>('accounts')
  const [filter, setFilter] = useState<AccountFilter>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, a, l] = await Promise.all([
        request<AdminOverview>('/api/admin/overview'),
        request<AdminAccount[]>('/api/admin/accounts'),
        request<AdminAuditRow[]>('/api/admin/audit?limit=100'),
      ])
      setOverview(o); setAccounts(a); setAudit(l)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo cargar el panel.', 'error') }
    finally { setLoading(false) }
    // The AI service check can be slow, so it never blocks the rest.
    request<AdminSystem>('/api/admin/system').then(setSystem).catch(() => setSystem(null))
  }, [notify])
  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => filterAccounts(accounts ?? [], filter, query), [accounts, filter, query])
  const count = (f: AccountFilter) => filterAccounts(accounts ?? [], f, '').length
  const onChanged = (account: AdminAccount) => {
    setAccounts(list => list && list.map(item => item.id === account.id ? account : item))
    void request<AdminAuditRow[]>('/api/admin/audit?limit=100').then(setAudit).catch(() => undefined)
    void request<AdminOverview>('/api/admin/overview').then(setOverview).catch(() => undefined)
  }

  return <section className="page admin">
    <header className="page-head">
      <div>
        <h1>Administración</h1>
        <p>Todas las cuentas de FairTeam en un solo lugar. Puedes ver cuánto usa cada docente y gestionar su acceso; los datos de los estudiantes no se muestran.</p>
      </div>
      <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? <Spinner size={16} /> : <RefreshCw size={16} aria-hidden />} Actualizar</button>
    </header>

    {!overview ? <div className="page-loading" role="status"><Spinner size={20} /> Cargando el panel…</div> : <>
      <dl className="stats admin-stats">
        <Stat icon={<Users size={16} />} label="Cuentas" value={overview.accounts} note={`${formatInt(overview.activeAccounts)} activas · ${formatInt(overview.admins)} admin`} />
        <Stat icon={<Activity size={16} />} label="Activas esta semana" value={overview.signedInLast7Days} note="Iniciaron sesión en 7 días" />
        <Stat icon={<UserPlus size={16} />} label="Nuevas" value={overview.newLast7Days} note={`${formatInt(overview.newLast30Days)} en los últimos 30 días`} />
        <Stat icon={<BookOpen size={16} />} label="Cursos" value={overview.courses} note={`${formatInt(overview.materials)} materiales subidos`} />
        <Stat icon={<GraduationCap size={16} />} label="Estudiantes" value={overview.students} note={`${formatInt(overview.grades)} notas registradas`} />
      </dl>

      <div className="admin-row">
        <Signups days={overview.signupsByDay} />
        <section className="admin-system" aria-labelledby="admin-system-title">
          <h2 id="admin-system-title">Estado del sistema</h2>
          <ul>
            <li><Database size={16} aria-hidden /> Base de datos <span className={`pill ${system ? (system.database ? 'pill-high' : 'pill-low') : 'pill-none'}`}>{system ? (system.database ? 'Conectada' : 'Sin conexión') : 'Comprobando…'}</span></li>
            <li><Sparkles size={16} aria-hidden /> Servicio de IA <span className={`pill ${system ? (system.ai.reachable ? 'pill-high' : 'pill-low') : 'pill-none'}`}>{system ? (system.ai.reachable ? 'En línea' : 'No responde') : 'Comprobando…'}</span></li>
            {system?.ai.model && <li className="muted">Modelo: {system.ai.model}</li>}
          </ul>
        </section>
      </div>

      <div className="toolbar admin-toolbar">
        <Segmented<Tab> label="Sección" value={tab} onChange={setTab} options={[{ value: 'accounts', label: 'Cuentas', count: accounts?.length }, { value: 'activity', label: 'Actividad de administradores', count: audit?.length }]} />
      </div>

      {tab === 'accounts' && <>
        <div className="toolbar">
          <label className="search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Buscar por nombre o correo" aria-label="Buscar cuentas" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <Segmented<AccountFilter> label="Filtrar cuentas" value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Todas', count: count('all') }, { value: 'teachers', label: 'Docentes', count: count('teachers') },
            { value: 'admins', label: 'Admin', count: count('admins') }, { value: 'empty', label: 'Sin cursos', count: count('empty') },
            { value: 'inactive', label: 'Desactivadas', count: count('inactive') }]} />
        </div>
        {shown.length ? <div className="table-card admin-table"><table className="table">
          <thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th className="num">Cursos</th><th className="num">Estudiantes</th><th className="num">Notas</th><th>Último ingreso</th></tr></thead>
          <tbody>{shown.map(account => <tr key={account.id} className="is-clickable">
            <td><button className="admin-who" onClick={() => setOpenId(account.id)} aria-label={`Abrir la cuenta de ${account.name}`}>
              <Avatar name={account.name} size={34} /><span><b>{account.name}</b><small>{account.email}</small></span>
            </button></td>
            <td>{account.role === 'ADMIN' ? <span className="pill pill-active"><ShieldCheck size={13} aria-hidden /> Admin</span> : 'Docente'}</td>
            <td><span className={`pill ${account.active ? 'pill-high' : 'pill-low'}`}>{account.active ? 'Activa' : 'Desactivada'}</span></td>
            <td className="num">{formatInt(account.courses)}</td><td className="num">{formatInt(account.students)}</td><td className="num">{formatInt(account.grades)}</td>
            <td>{lastSeen(account.lastLoginAt)}</td>
          </tr>)}</tbody>
        </table><div className="table-foot">{formatInt(shown.length)} de {formatInt(accounts?.length ?? 0)} cuentas</div></div>
          : <EmptyState art="think" title="Ninguna cuenta coincide" text="Prueba con otro nombre o cambia el filtro." />}
      </>}

      {tab === 'activity' && (audit?.length ? <div className="table-card"><table className="table">
        <thead><tr><th>Cuándo</th><th>Administrador</th><th>Acción</th><th>Cuenta</th></tr></thead>
        <tbody>{audit.map(row => <tr key={row.id}>
          <td>{new Date(row.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td>{row.admin}</td>
          <td>{actionLabel(row.action)}{row.action === 'ROLE_CHANGED' && row.detail ? <small className="muted"> ({row.detail.replace('->', '→')})</small> : null}</td>
          <td>{row.target ?? '—'}</td>
        </tr>)}</tbody></table></div>
        : <EmptyState art="read" title="Aún no hay actividad" text="Cada cambio que hagas sobre una cuenta queda registrado aquí." />)}
    </>}

    {openId != null && <AccountDialog id={openId} selfId={user.id} onClose={() => setOpenId(null)} onChanged={onChanged} />}
  </section>
}
