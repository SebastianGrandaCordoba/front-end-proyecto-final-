import { useEffect, useState } from 'react'
import { Copy, KeyRound, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react'
import { request } from '../../api'
import { Avatar, Modal, Spinner, useFeedback } from '../../components/ui'
import { formatInt, plural } from '../../lib/domain'
import { lastSeen, type AdminAccount, type AdminAccountDetail } from '../../lib/admin'

/** One account: what it holds (counts only, never student data) and the actions an administrator can take. */
export function AccountDialog({ id, selfId, onClose, onChanged }: { id: number; selfId: number; onClose: () => void; onChanged: (account: AdminAccount) => void }) {
  const { notify, confirm } = useFeedback()
  const [detail, setDetail] = useState<AdminAccountDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    request<AdminAccountDetail>(`/api/admin/accounts/${id}`).then(value => { if (alive) setDetail(value) })
      .catch(error => { notify(error instanceof Error ? error.message : 'No se pudo cargar la cuenta.', 'error'); onClose() })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const change = async (body: { active?: boolean; role?: string }, success: string) => {
    setBusy(true)
    try {
      const account = await request<AdminAccount>(`/api/admin/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setDetail(current => current && { ...current, account })
      onChanged(account)
      notify(success)
    } catch (error) { notify(error instanceof Error ? error.message : 'No se pudo aplicar el cambio.', 'error') }
    finally { setBusy(false) }
  }

  const toggleActive = async (account: AdminAccount) => {
    if (account.active && !await confirm({ title: `¿Desactivar a ${account.name}?`, body: 'Su sesión se cierra de inmediato y no podrá volver a entrar hasta que la actives. Sus cursos y notas se conservan.', confirm: 'Desactivar cuenta', danger: true })) return
    await change({ active: !account.active }, account.active ? 'Cuenta desactivada.' : 'Cuenta activada.')
  }
  const toggleRole = async (account: AdminAccount) => {
    const toAdmin = account.role !== 'ADMIN'
    if (!await confirm({ title: toAdmin ? `¿Dar permisos de administrador a ${account.name}?` : `¿Quitar permisos de administrador a ${account.name}?`, body: toAdmin ? 'Podrá ver todas las cuentas y gestionar el acceso de los demás.' : 'Volverá a ser un docente normal.', confirm: toAdmin ? 'Hacer administrador' : 'Quitar permisos', danger: !toAdmin })) return
    await change({ role: toAdmin ? 'ADMIN' : 'TEACHER' }, toAdmin ? 'Ahora es administrador.' : 'Ya no es administrador.')
  }
  const reset = async (account: AdminAccount) => {
    if (!await confirm({ title: `¿Restablecer la contraseña de ${account.name}?`, body: 'Se crea una contraseña temporal que verás una sola vez. La contraseña actual deja de funcionar.', confirm: 'Restablecer', danger: true })) return
    setBusy(true)
    try { setPassword((await request<{ temporaryPassword: string }>(`/api/admin/accounts/${id}/reset-password`, { method: 'POST' })).temporaryPassword) }
    catch (error) { notify(error instanceof Error ? error.message : 'No se pudo restablecer.', 'error') }
    finally { setBusy(false) }
  }
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); notify(`${what} copiado.`) } catch { notify('No se pudo copiar; selecciónalo a mano.', 'error') }
  }

  const account = detail?.account
  const isSelf = account?.id === selfId
  return <Modal title={account?.name ?? 'Cuenta'} description={account?.email} onClose={onClose} size="large">
    {!account ? <div className="page-loading"><Spinner size={20} /> Cargando…</div> : <div className="admin-detail">
      <div className="admin-detail-head">
        <Avatar name={account.name} size={48} />
        <div className="admin-badges">
          <span className={`pill ${account.role === 'ADMIN' ? 'pill-active' : 'pill-none'}`}>{account.role === 'ADMIN' ? 'Administrador' : 'Docente'}</span>
          <span className={`pill ${account.active ? 'pill-high' : 'pill-low'}`}>{account.active ? 'Activa' : 'Desactivada'}</span>
        </div>
        <p>Creada el {account.createdAt ? new Date(account.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} · Último ingreso: {lastSeen(account.lastLoginAt).toLowerCase()}</p>
      </div>

      <dl className="admin-counts">
        <div><dt>Cursos</dt><dd>{formatInt(account.courses)}</dd></div>
        <div><dt>Estudiantes</dt><dd>{formatInt(account.students)}</dd></div>
        <div><dt>Notas</dt><dd>{formatInt(account.grades)}</dd></div>
        <div><dt>Materiales</dt><dd>{formatInt(account.materials)}</dd></div>
      </dl>

      <section aria-labelledby="admin-courses">
        <h3 id="admin-courses">Cursos de esta cuenta</h3>
        {detail.courses.length ? <ul className="admin-courses">
          {detail.courses.map(course => <li key={course.id}>
            <span><b>{course.name}</b>{course.period && <span className="muted"> · {course.period}</span>}</span>
            <small>{plural(course.students, 'estudiante', 'estudiantes')} · {plural(course.grades, 'nota', 'notas')} · {plural(course.materials, 'material', 'materiales')}</small>
          </li>)}
        </ul> : <p className="muted">Todavía no creó ningún curso.</p>}
        <p className="admin-privacy">Por privacidad, el panel muestra totales y nombres de curso, no los datos de los estudiantes.</p>
      </section>

      {password && <div className="admin-secret" role="status">
        <b>Contraseña temporal</b>
        <code>{password}</code>
        <button className="btn btn-secondary btn-small" onClick={() => void copy(password, 'La contraseña')}><Copy size={14} aria-hidden /> Copiar</button>
        <small>Entrégasela a {account.name.split(' ')[0]} por un canal seguro. No se vuelve a mostrar.</small>
      </div>}

      <div className="admin-actions">
        <button className="btn btn-secondary" disabled={busy || isSelf} onClick={() => void toggleActive(account)} title={isSelf ? 'No puedes desactivarte a ti mismo' : undefined}>
          {account.active ? <><UserX size={16} aria-hidden /> Desactivar cuenta</> : <><UserCheck size={16} aria-hidden /> Activar cuenta</>}
        </button>
        <button className="btn btn-secondary" disabled={busy || isSelf} onClick={() => void toggleRole(account)} title={isSelf ? 'No puedes cambiar tu propio rol' : undefined}>
          {account.role === 'ADMIN' ? <><ShieldOff size={16} aria-hidden /> Quitar administrador</> : <><ShieldCheck size={16} aria-hidden /> Hacer administrador</>}
        </button>
        {account.role !== 'ADMIN' && <button className="btn btn-secondary" disabled={busy} onClick={() => void reset(account)}><KeyRound size={16} aria-hidden /> Restablecer contraseña</button>}
        <button className="btn btn-ghost" onClick={() => void copy(account.email, 'El correo')}><Copy size={16} aria-hidden /> Copiar correo</button>
      </div>
    </div>}
  </Modal>
}
