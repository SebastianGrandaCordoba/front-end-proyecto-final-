/** Attendance types shared by the roll sheet, the student list and the student profile. */
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'

export interface AttendanceSummary { studentId: number; sessions: number; present: number; absent: number; late: number; excused: number; percent: number; alert: boolean }

export const statusLabel: Record<AttendanceStatus, string> = { PRESENT: 'Presente', ABSENT: 'Falta', LATE: 'Tarde', EXCUSED: 'Excusa' }
export const statusShort: Record<AttendanceStatus, string> = { PRESENT: 'P', ABSENT: 'F', LATE: 'T', EXCUSED: 'E' }
export const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

/** Local date as YYYY-MM-DD (not UTC), so evening classes in Bogotá are not saved as tomorrow. */
export function isoDate(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function sessionLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const text = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Counts marks by status for the header ("18 presentes · 2 faltas"). */
export function tally(marks: Map<number, AttendanceStatus>) {
  const counts: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
  for (const status of marks.values()) counts[status]++
  return counts
}

/** True when the sheet has unsaved changes compared with what the server returned. */
export function changed(saved: Map<number, AttendanceStatus>, current: Map<number, AttendanceStatus>) {
  if (saved.size !== current.size) return true
  for (const [id, status] of current) if (saved.get(id) !== status) return true
  return false
}
