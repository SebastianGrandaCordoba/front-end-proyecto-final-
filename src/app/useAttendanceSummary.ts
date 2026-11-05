import { useCallback, useEffect, useState } from 'react'
import { request } from '../api'
import type { AttendanceSummary } from '../lib/attendance'

/** Attendance percentage per student of the open course; empty until the teacher takes roll. */
export function useAttendanceSummary(courseId: number | null) {
  const [summary, setSummary] = useState<Map<number, AttendanceSummary>>(new Map())
  const reload = useCallback(async () => {
    if (!courseId) { setSummary(new Map()); return }
    try {
      const rows = await request<AttendanceSummary[]>(`/api/courses/${courseId}/attendance/summary`)
      setSummary(new Map(rows.map(row => [row.studentId, row])))
    } catch { setSummary(new Map()) }
  }, [courseId])
  useEffect(() => { void reload() }, [reload])
  return { summary, reload }
}
