/* Voice in and out with the browser's own Web Speech API: no keys, nothing leaves the device except
   what the browser's recognizer sends (Chrome uses Google's service; Edge uses Microsoft's). */

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
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

let voice: SpeechSynthesisVoice | null = null
function pickVoice() {
  if (!canSpeak()) return null
  const voices = window.speechSynthesis.getVoices()
  const order = ['es-CO', 'es-MX', 'es-US', 'es-419', 'es-ES', 'es']
  for (const lang of order) {
    const match = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()))
    const best = match.find(v => /natural|online|google|neural/i.test(v.name)) ?? match[0]
    if (best) return best
  }
  return null
}
if (canSpeak()) window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice() }

/** Speaks text in Spanish. Resolves when finished or interrupted. */
export function speak(text: string, { onStart, onEnd }: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!canSpeak()) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  voice = voice ?? pickVoice()
  const clean = text.replace(/[•·→]/g, ', ').replace(/\s+/g, ' ').replace(/(\d),(\d)/g, '$1 coma $2').trim()
  // Chrome stops long utterances after ~15 s; speak sentence by sentence.
  const parts = clean.match(/[^.!?]+[.!?]?/g) ?? [clean]
  parts.forEach((part, index) => {
    const u = new SpeechSynthesisUtterance(part.trim())
    u.lang = voice?.lang ?? 'es-CO'
    if (voice) u.voice = voice
    u.rate = 1.03
    u.pitch = 1
    if (index === 0) u.onstart = () => onStart?.()
    if (index === parts.length - 1) { u.onend = () => onEnd?.(); u.onerror = () => onEnd?.() }
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() { if (canSpeak()) window.speechSynthesis.cancel() }

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
