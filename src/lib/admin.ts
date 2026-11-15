/** Types and pure helpers for the super administrator screen. */
export interface AdminOverview {
  accounts: number; activeAccounts: number; admins: number; signedInLast7Days: number
  newLast7Days: number; newLast30Days: number
  courses: number; students: number; grades: number; materials: number; workshops: number
  signupsByDay: { day: string; signups: number }[]
}
export interface AdminAccount {
  id: number; name: string; email: string; role: 'TEACHER' | 'ADMIN'; active: boolean
  createdAt: string | null; lastLoginAt: string | null
  courses: number; students: number; grades: number; materials: number
}
export interface AdminCourse { id: number; name: string; period: string | null; createdAt: string | null; students: number; grades: number; materials: number }
export interface AdminAccountDetail { account: AdminAccount; courses: AdminCourse[] }
export interface AdminAuditRow { id: number; admin: string; action: string; targetId: number | null; target: string | null; detail: string | null; createdAt: string }
export interface AdminSystem { database: boolean; ai: { reachable: boolean; model: string | null } }

export type AccountFilter = 'all' | 'teachers' | 'admins' | 'inactive' | 'empty'

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Filters by group and by a search over name and email (accents and case ignored). */
export function filterAccounts(accounts: AdminAccount[], filter: AccountFilter, query: string): AdminAccount[] {
  const needle = fold(query.trim())
  return accounts.filter(account => {
    if (filter === 'teachers' && account.role !== 'TEACHER') return false
    if (filter === 'admins' && account.role !== 'ADMIN') return false
    if (filter === 'inactive' && account.active) return false
    if (filter === 'empty' && (account.role !== 'TEACHER' || account.courses > 0)) return false
    return !needle || fold(account.name).includes(needle) || fold(account.email).includes(needle)
  })
}

/** "hoy", "ayer", "hace 5 días", "hace 3 meses"; "nunca" when there is no date. */
export function lastSeen(iso: string | null, now = new Date()): string {
  if (!iso) return 'Nunca'
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  return months < 12 ? `Hace ${months} ${months === 1 ? 'mes' : 'meses'}` : 'Hace más de un año'
}

const ACTIONS: Record<string, string> = {
  ACCOUNT_ACTIVATED: 'Activó la cuenta', ACCOUNT_DEACTIVATED: 'Desactivó la cuenta',
  ROLE_CHANGED: 'Cambió el rol', PASSWORD_RESET: 'Restableció la contraseña',
}
export const actionLabel = (action: string) => ACTIONS[action] ?? action
