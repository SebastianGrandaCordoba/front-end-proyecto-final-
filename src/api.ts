export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://backend-proyect-junz.onrender.com').replace(/\/$/, '')

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options)
  if (!response.ok) {
    const body = await response.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed.message || parsed.detail || body
    } catch { /* Keep the server's plain text error. */ }
    throw new Error(message || `La solicitud falló (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export type AcademicLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export interface Student {
  id: number
  name: string
  email?: string | null
  academicLevel?: string | null
  createdAt?: string
}
export interface Grade {
  id: number
  studentId?: number
  subjectId?: number
  grade: number | string
  period: string
}
export interface Project {
  id: number
  name: string
  description?: string
  teamSize: number
}
export interface Team {
  id: number
  name: string
  project?: Project
  formationStrategy?: string
  score?: number
  explanation?: string
}
export interface WorkshopActivity { title: string; instructions: string; estimatedMinutes: number }
export interface WorkshopQuestion { question: string; options: string[]; correctAnswer: string; explanation: string }
export interface GeneratedWorkshop {
  title: string
  subject: string
  targetLevel: string
  summary: string
  learningObjectives: string[]
  activities: WorkshopActivity[]
  assessment: WorkshopQuestion[]
  sourceReferences: string[]
  savedAt?: string
}
