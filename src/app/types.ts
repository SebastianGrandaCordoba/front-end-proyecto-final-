import type { AcademicLevel } from '../api'
import type { Candidate } from '../lib/domain'

export type SupportMode = 'workshop' | 'quiz' | 'custom'

/** What the teacher asked for from another screen; the workshop page pre-fills itself from it. */
export type WorkshopIntent = {
  mode: SupportMode
  level: AcademicLevel
  topic?: string
  student?: Candidate
  group?: number
  autoStart?: boolean
}
