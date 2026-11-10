/* Voice in and out. Búho speaks with a natural voice made by the AI service (Gemini TTS, through the
   backend, so no key reaches the browser) and falls back to the browser's own voice when that is off,
   slow to arrive, out of quota or blocked. Listening uses the browser's Web Speech API. */
import { API_BASE, TOKEN_KEY } from '../api'

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  start: () => void; stop: () => void; abort: () => void
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

const RecognitionCtor = (): (new () => Recognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canListen = () => typeof window !== 'undefined' && RecognitionCtor() !== null
export const canSpeak = () => typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined')

let voice: SpeechSynthesisVoice | null = null
function pickVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  const order = ['es-CO', 'es-MX', 'es-US', 'es-419', 'es-ES', 'es']
  for (const lang of order) {
    const match = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()))
    const best = match.find(v => /natural|online|google|neural/i.test(v.name)) ?? match[0]
    if (best) return best
  }
  return null
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice() }

type SpeakOptions = { onStart?: () => void; onEnd?: () => void }

const NATURAL_KEY = 'fairteam.buho.natural'
/** "Voz natural" in Ajustes (on unless the teacher turned it off). */
export function naturalVoice() { try { return localStorage.getItem(NATURAL_KEY) !== 'off' } catch { return true } }
export function setNaturalVoice(on: boolean) { try { localStorage.setItem(NATURAL_KEY, on ? 'on' : 'off') } catch { /* private mode */ } }

let current: { audio: HTMLAudioElement | null; abort: AbortController; url: string | null } | null = null
/** After the server says the natural voice is unavailable, the browser voice is used for a while. */
let naturalPausedUntil = 0

function stopNatural() {
  if (!current) return
  current.abort.abort()
  current.audio?.pause()
  if (current.url) URL.revokeObjectURL(current.url)
  current = null
}

async function speakNatural(text: string, { onStart, onEnd }: SpeakOptions): Promise<'played' | 'stopped'> {
  const abort = new AbortController()
  const mine = { audio: null as HTMLAudioElement | null, abort, url: null as string | null }
  current = mine
  const timeout = window.setTimeout(() => abort.abort('slow'), 15000)
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const response = await fetch(`${API_BASE}/api/assistant/speech`, {
      method: 'POST', signal: abort.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) { if (response.status === 503 || response.status === 404) naturalPausedUntil = Date.now() + 5 * 60_000; throw new Error('unavailable') }
    const blob = await response.blob()
    if (current !== mine) return 'stopped'
    mine.url = URL.createObjectURL(blob)
    const audio = new Audio(mine.url)
    mine.audio = audio
    audio.playbackRate = speechRate()
    audio.onplay = () => onStart?.()
    audio.onended = () => { if (mine.url) URL.revokeObjectURL(mine.url); if (current === mine) current = null; onEnd?.() }
    await audio.play()
    return 'played'
  } catch (error) {
    if (current !== mine || (abort.signal.aborted && abort.signal.reason !== 'slow')) return 'stopped'
    if (current === mine) current = null
    throw error
  } finally { window.clearTimeout(timeout) }
}

/** Speaks text in Spanish: the natural voice when it is on and available, otherwise the browser's. */
export function speak(text: string, options: SpeakOptions = {}) {
  stopSpeaking()
  if (naturalVoice() && Date.now() > naturalPausedUntil && typeof Audio !== 'undefined') {
    void speakNatural(text, options).catch(() => browserSpeak(text, options))
    return
  }
  browserSpeak(text, options)
}

function browserSpeak(text: string, { onStart, onEnd }: SpeakOptions) {
  if (!('speechSynthesis' in window)) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  voice = voice ?? pickVoice()
  const clean = text.replace(/[•·→]/g, ', ').replace(/\s+/g, ' ').replace(/(\d),(\d)/g, '$1 coma $2').trim()
  // Chrome stops long utterances after ~15 s; speak sentence by sentence.
  const parts = clean.match(/[^.!?]+[.!?]?/g) ?? [clean]
  parts.forEach((part, index) => {
    const u = new SpeechSynthesisUtterance(part.trim())
    u.lang = voice?.lang ?? 'es-CO'
    if (voice) u.voice = voice
    u.rate = speechRate()
    u.pitch = 1
    if (index === 0) u.onstart = () => onStart?.()
    if (index === parts.length - 1) { u.onend = () => onEnd?.(); u.onerror = () => onEnd?.() }
    window.speechSynthesis.speak(u)
  })
}

const RATE_KEY = 'fairteam.buho.rate'
/** Voice speed chosen in Ajustes (0.8 slow – 1.3 fast). */
export function speechRate() {
  try { const value = Number(localStorage.getItem(RATE_KEY)); return value >= 0.7 && value <= 1.4 ? value : 1.03 } catch { return 1.03 }
}
export function setSpeechRate(rate: number) { try { localStorage.setItem(RATE_KEY, String(rate)) } catch { /* private mode */ } }

export function stopSpeaking() {
  stopNatural()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}

/** Starts listening once; returns a stop function. */
export function listen({ onPartial, onFinal, onError, onEnd }: { onPartial?: (text: string) => void; onFinal: (text: string) => void; onError?: (message: string) => void; onEnd?: () => void }) {
  const Ctor = RecognitionCtor()
  if (!Ctor) { onError?.('Tu navegador no permite dictar por voz. Prueba con Chrome o Edge.'); onEnd?.(); return () => {} }
  const rec = new Ctor()
  rec.lang = 'es-CO'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  let finalText = ''
  rec.onresult = event => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) finalText += result[0].transcript
      else interim += result[0].transcript
    }
    onPartial?.((finalText + interim).trim())
  }
  rec.onerror = event => {
    const messages: Record<string, string> = {
      'not-allowed': 'No tengo permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.',
      'no-speech': 'No te escuché. Toca el micrófono e inténtalo de nuevo.',
      'audio-capture': 'No encuentro un micrófono conectado.',
      network: 'El dictado necesita conexión a internet.',
    }
    if (event.error !== 'aborted') onError?.(messages[event.error] ?? 'No pude entender el audio.')
  }
  rec.onend = () => { if (finalText.trim()) onFinal(finalText.trim()); onEnd?.() }
  try { rec.start() } catch { onError?.('El micrófono ya está en uso.'); onEnd?.() }
  return () => { try { rec.stop() } catch { /* already stopped */ } }
}
