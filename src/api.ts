export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://backend-proyect-junz.onrender.com').replace(/\/$/, '')
export const TOKEN_KEY = 'fairteam.accessToken'
export function saveAccessToken(token: string) { sessionStorage.setItem(TOKEN_KEY, token) }
export function clearAccessToken() { sessionStorage.removeItem(TOKEN_KEY) }

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 120_000)
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal })
    if (!response.ok) {
      const body = await response.text()
      let message = ''
      try {
        const parsed = JSON.parse(body)
        message = parsed.message || parsed.detail || ''
      } catch { /* Use a friendly message for framework error payloads. */ }
      if (!message && path === '/api/auth/login' && response.status === 401) {
        message = 'El correo o la contraseña no coinciden. Revisa tus datos o crea una cuenta.'
      } else if (!message && path === '/api/auth/register' && response.status === 409) {
        message = 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.'
      } else if (!message && (response.status === 400 || response.status === 422)) {
        message = 'Revisa los datos ingresados e inténtalo de nuevo.'
      } else if (!message && response.status >= 500) {
        message = 'El servidor encontró un problema al procesar la solicitud. Inténtalo de nuevo en unos minutos.'
      } else if (!message) {
        message = `La solicitud no se pudo completar (${response.status}).`
      }
      throw new Error(message)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new Error('El servidor tardó demasiado en responder. Puede estar iniciándose; espera un momento y vuelve a intentarlo.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

export type AcademicLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export interface TeacherProfile { id: number; name: string; email: string; role: string }
export interface AuthResponse extends TeacherProfile { accessToken: string }
export interface Student {
  id: number
  name: string
  email?: string | null
  academicLevel?: string | null
  createdAt?: string
  courseId?: number | null
}
export interface Course {
  id: number
  name: string
  period?: string | null
  description?: string | null
  createdAt?: string
}
export interface CourseMaterial {
  id: number
  courseId: number
  fileName: string
  contentType: string
  fileSize: number
  createdAt: string
}
export interface Grade {
  id: number
  studentId?: number
  subjectId?: number
  grade: number | string
  period: string
  courseId?: number | null
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
