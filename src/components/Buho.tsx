import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, Copy, Mic, Play, Square, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import FairTeamMark from '../FairTeamMark'
import Owl from './Owl'
import { request } from '../api'
import { adaptReply, examples, type ApiReply, type BuhoAction, type BuhoReply } from '../lib/buho'
import type { Candidate } from '../lib/domain'
import { teacherFirstName } from '../lib/domain'
import { canListen, canSpeak, listen, speak, stopSpeaking } from '../lib/speech'
import { Avatar } from './ui'

type Message = { id: number; from: 'me' | 'buho'; text: string; reply?: BuhoReply }
type Status = 'idle' | 'listening' | 'thinking' | 'speaking'

export type BuhoContext = { teacher: string; courseId: number | null; courseName: string | null; candidates: Candidate[]; weakestSubject?: string | null }

export default function Buho({ context, onAction, open, setOpen, briefToken }: { context: BuhoContext; onAction: (action: BuhoAction) => void; open: boolean; setOpen: (open: boolean) => void; briefToken: number }) {
  const storageKey = `fairteam.buho.${context.courseId ?? 'none'}`
  const [messages, setMessages] = useState<Message[]>(() => { try { return JSON.parse(sessionStorage.getItem(storageKey) || '[]') as Message[] } catch { return [] } })
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [voiceOn, setVoiceOn] = useState(() => canSpeak() && localStorage.getItem('fairteam.buho.voice') !== 'off')
  const [error, setError] = useState('')
  const counter = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const stopListening = useRef<() => void>(() => {})
  const contextRef = useRef(context)
  contextRef.current = context

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(!open) }
      if (event.key === 'Escape' && open && !document.querySelector('.modal-backdrop')) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 60); else { stopSpeaking(); stopListening.current(); setStatus('idle') } }, [open])
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [messages, status])
  // Keep the conversation of each course while the tab is open.
  useEffect(() => { try { setMessages(JSON.parse(sessionStorage.getItem(storageKey) || '[]') as Message[]) } catch { setMessages([]) } }, [storageKey])
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40))) } catch { /* storage full */ } }, [messages, storageKey])
  useEffect(() => { counter.current = Math.max(counter.current, ...messages.map(m => m.id), 0) }, [messages])

  const say = useCallback((text: string, force = false) => {
    // The answer is already on screen: leave "thinking" now, even if the voice never starts (no voices installed).
    setStatus('idle')
    if (!(voiceOn || force) || !canSpeak()) return
    speak(text, { onStart: () => setStatus('speaking'), onEnd: () => setStatus(current => current === 'speaking' ? 'idle' : current) })
  }, [voiceOn])

  /** Asks the backend (insights assistant). Returns null when the course or the server is not available. */
  const fetchReply = useCallback(async (question: string): Promise<BuhoReply | null> => {
    const { courseId, candidates } = contextRef.current
    // "¿Cómo se usa?", "muéstrame el tutorial": the guided tour answers better than words.
    if (/tutorial|recorrido|c[oó]mo (se )?usa|c[oó]mo funciona (la|esta) (app|plataforma)|ens[eé]ñame a usar/i.test(question)) {
      window.setTimeout(() => window.dispatchEvent(new Event('fairteam:tour')), 600)
      return { text: 'Te abro el recorrido guiado: te muestro cada sección en la pantalla real. Puedes volver a verlo cuando quieras desde Ajustes.' }
    }
    if (!courseId) return { text: 'Primero crea o elige un curso y te ayudo con todo lo demás.', actions: [{ kind: 'navigate', label: 'Mis cursos', route: 'cursos' }] }
    try {
      const api = await request<ApiReply>(`/api/courses/${courseId}/assistant`, { method: 'POST', body: JSON.stringify({ question }) })
      return adaptReply(api, candidates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude conectarme con el servidor.')
      return null
    }
  }, [])

  const ask = useCallback(async (question: string, { spoken = false } = {}) => {
    const q = question.trim()
    if (!q) return
    setError('')
    setMessages(current => [...current, { id: ++counter.current, from: 'me', text: q }])
    setDraft('')
    setStatus('thinking')
    const reply = await fetchReply(q)
    if (!reply) { setStatus('idle'); return }
    setMessages(current => [...current, { id: ++counter.current, from: 'buho', text: reply.text, reply }])
    if (reply.run) window.setTimeout(() => onAction(reply.run!), 450)
    if (voiceOn || spoken) say(reply.text, spoken)
    else setStatus('idle')
  }, [fetchReply, onAction, say, voiceOn])

  const playBriefing = async () => {
    setError('')
    setStatus('thinking')
    const reply = await fetchReply('resumen del día')
    if (!reply) { setStatus('idle'); return }
    setMessages(current => [...current, { id: ++counter.current, from: 'buho', text: reply.text, reply }])
    say(reply.text, true)
  }

  useEffect(() => { if (briefToken > 0) void playBriefing() }, [briefToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = () => {
    if (status === 'listening') { stopListening.current(); return }
    stopSpeaking()
    setError('')
    setStatus('listening')
    stopListening.current = listen({
      onPartial: text => setDraft(text),
      onFinal: text => void ask(text, { spoken: true }),
      onError: message => setError(message),
      onEnd: () => setStatus(current => current === 'listening' ? 'idle' : current),
    })
  }

  const submit = (event: FormEvent) => { event.preventDefault(); stopListening.current(); void ask(draft) }
  const toggleVoice = () => { const next = !voiceOn; setVoiceOn(next); localStorage.setItem('fairteam.buho.voice', next ? 'on' : 'off'); if (!next) { stopSpeaking(); setStatus('idle') } }
  const statusLabel = { idle: 'Listo para ayudarte', listening: 'Te escucho…', thinking: 'Pensando…', speaking: 'Hablando…' }[status]

  return <>

    {open && <aside className={`buho is-${status}`} role="dialog" aria-modal="false" aria-label="Asistente Búho">
      <header className="buho-head">
        <div className="buho-orb" aria-hidden><span className="ring r1" /><span className="ring r2" /><span className="ring r3" /><FairTeamMark size={34} /></div>
        <div className="buho-title"><b>Búho</b><span aria-live="polite">{statusLabel}</span></div>
        {canSpeak() && <button className="icon-btn" onClick={toggleVoice} aria-label={voiceOn ? 'Silenciar respuestas' : 'Leer respuestas en voz alta'} title={voiceOn ? 'Silenciar' : 'Activar voz'}>{voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>}
        {status === 'speaking' && <button className="icon-btn" onClick={() => { stopSpeaking(); setStatus('idle') }} aria-label="Detener la voz"><Square size={15} /></button>}
        {messages.length > 0 && <button className="icon-btn" onClick={() => { stopSpeaking(); setMessages([]) }} aria-label="Borrar la conversación" title="Nueva conversación"><Trash2 size={16} /></button>}
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar asistente"><X size={18} /></button>
      </header>

      <div className="buho-body" ref={list}>
        {messages.length === 0 && <div className="buho-welcome">
          <Owl pose="wave" size={112} className="buho-welcome-owl" />
          <p className="buho-hello">Hola, {teacherFirstName(context.teacher)}. Soy tu asistente. Pregúntame por tus estudiantes o pídeme que prepare algo.</p>
          <button className="buho-brief" onClick={() => void playBriefing()} disabled={status === 'thinking'}><span><Play size={16} aria-hidden /></span><b>Escuchar el resumen del día</b><small>Cómo va {context.courseName ?? 'tu curso'} y qué hacer primero</small></button>
          <div className="buho-examples"><span>Prueba con:</span>{context.weakestSubject && <button className="chip chip-accent" onClick={() => void ask(`¿Quién necesita refuerzo en ${context.weakestSubject}?`)}>¿Quién necesita refuerzo en {context.weakestSubject}?</button>}{examples.map(example => <button key={example} className="chip" onClick={() => void ask(example)}>{example}</button>)}</div>
        </div>}
        {messages.map(message => message.from === 'me'
          ? <div key={message.id} className="msg msg-me">{message.text}</div>
          : <div key={message.id} className="msg msg-buho">
            <p>{message.text}</p>
            <button className="msg-copy icon-btn" onClick={() => void navigator.clipboard?.writeText(message.text)} aria-label="Copiar respuesta" title="Copiar respuesta"><Copy size={14} /></button>
            {message.reply?.items && message.reply.items.length > 0 && <ul className="msg-items">{message.reply.items.map(item => <li key={item.student.id}>
              <button onClick={() => onAction({ kind: 'review', label: '', student: item.student })}>
                <Avatar name={item.student.name} size={28} /><span><b>{item.student.name}</b><small>{item.note}</small></span><em className={`tone-${item.tone}`}>{item.value}</em>
              </button></li>)}</ul>}
            {message.reply?.followUps && message.reply.followUps.length > 0 && message.id === messages[messages.length - 1]?.id && <div className="msg-followups">{message.reply.followUps.map(q => <button key={q} className="chip" onClick={() => void ask(q)}>{q}</button>)}</div>}
            {message.reply?.actions && message.reply.actions.length > 0 && <div className="msg-actions">{message.reply.actions.map((action, i) => <button key={i} className={`btn btn-small ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onAction(action)}>{action.label}</button>)}</div>}
          </div>)}
        {status === 'thinking' && <div className="msg msg-buho msg-typing" aria-label="Pensando"><i /><i /><i /></div>}
      </div>

      {error && <p className="buho-error" role="alert">{error} <button className="link-btn" onClick={() => { const last = [...messages].reverse().find(m => m.from === 'me'); if (last) void ask(last.text) }}>Reintentar</button></p>}
      <form className="buho-input" onSubmit={submit}>
        {canListen() && <button type="button" className={`buho-mic${status === 'listening' ? ' is-on' : ''}`} onClick={toggleMic} aria-label={status === 'listening' ? 'Dejar de escuchar' : 'Hablar con el Búho'} aria-pressed={status === 'listening'}>
          {status === 'listening' ? <span className="wave" aria-hidden><i /><i /><i /><i /></span> : <Mic size={19} />}
        </button>}
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} placeholder={status === 'listening' ? 'Habla ahora…' : 'Pregunta o pide algo…'} aria-label="Mensaje para el Búho" autoComplete="off" />
        <button className="buho-send" disabled={!draft.trim()} aria-label="Enviar"><ArrowUp size={18} /></button>
      </form>
    </aside>}
  </>
}
