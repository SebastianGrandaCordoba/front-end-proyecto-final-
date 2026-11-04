import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react'
import type { AcademicLevel } from '../api'
import { initials, levelShort } from '../lib/domain'
import Owl, { type OwlPose } from './Owl'

/* ---------- Feedback: toasts and confirmation, shared through context ---------- */

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: ToastKind; message: string }
type ConfirmRequest = { title: string; body: string; confirm: string; danger?: boolean; resolve: (value: boolean) => void }
type Feedback = {
  notify: (message: string, kind?: ToastKind) => void
  confirm: (options: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>
}

const FeedbackContext = createContext<Feedback | null>(null)

export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider')
  return value
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<ConfirmRequest | null>(null)
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(toast => toast.id !== id)), [])
  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++counter.current
    setToasts(list => [...list.slice(-2), { id, kind, message }])
    window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4200)
  }, [dismiss])
  const confirm = useCallback((options: Omit<ConfirmRequest, 'resolve'>) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), [])
  const close = (value: boolean) => { pending?.resolve(value); setPending(null) }

  return <FeedbackContext.Provider value={{ notify, confirm }}>
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
        {toast.kind === 'success' ? <CheckCircle2 size={18} aria-hidden /> : toast.kind === 'error' ? <AlertTriangle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
        <span>{toast.message}</span>
        <button className="icon-btn" onClick={() => dismiss(toast.id)} aria-label="Cerrar aviso"><X size={16} /></button>
      </div>)}
    </div>
    {pending && <Modal title={pending.title} onClose={() => close(false)} size="small">
      <p className="modal-text">{pending.body}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => close(false)}>Cancelar</button>
        <button className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>{pending.confirm}</button>
      </div>
    </Modal>}
  </FeedbackContext.Provider>
}

/* ---------- Modal ---------- */

export function Modal({ title, description, children, onClose, size = 'medium' }: { title: string; description?: string; children: ReactNode; onClose: () => void; size?: 'small' | 'medium' | 'large' }) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current() }
      if (event.key === 'Tab' && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
        if (!focusable.length) return
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('has-modal')
    if (!panel.current?.contains(document.activeElement)) panel.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not(.modal-close)')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      if (!document.querySelector('.modal-backdrop ~ .modal-backdrop')) document.body.classList.remove('has-modal')
      previous?.focus?.()
    }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={panel} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="modal-head">
        <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
      </header>
      {children}
    </div>
  </div>
}

/* ---------- Small pieces ---------- */

export function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden />
}

export function EmptyState({ icon, art, title, text, action }: { icon?: ReactNode; art?: OwlPose; title: string; text: string; action?: ReactNode }) {
  return <div className="empty">{art ? <Owl pose={art} size={120} className="empty-art" /> : icon && <span className="empty-icon" aria-hidden>{icon}</span>}<strong>{title}</strong><p>{text}</p>{action && <div className="empty-action">{action}</div>}</div>
}

const avatarHues = [184, 28, 262, 138, 340, 210, 52, 300]
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hue = avatarHues[hash % avatarHues.length]
  return <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 45% 28%)` }} aria-hidden>{initials(name)}</span>
}

export function LevelPill({ level, hasGrades = true }: { level: AcademicLevel; hasGrades?: boolean }) {
  if (!hasGrades) return <span className="pill pill-none">Sin notas</span>
  return <span className={`pill pill-${level.toLowerCase()}`}>{levelShort[level]}</span>
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (value: T) => void; label: string }) {
  return <div className="segmented" role="radiogroup" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'is-on' : ''} onClick={() => onChange(option.value)}>
      {option.label}{option.count != null && <span className="seg-count">{option.count}</span>}
    </button>)}
  </div>
}

export function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}{optional && <span className="field-optional">Opcional</span>}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>
}
