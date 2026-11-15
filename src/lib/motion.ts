import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts up to `target` once on mount and again whenever it changes. Skips the animation for reduced motion. */
export function useCountUp(target: number | null, duration = 900) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null) return
    if (reduced()) { setValue(target); from.current = target; return }
    let frame = 0
    const start = from.current
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const next = start + (target - start) * (1 - Math.pow(1 - p, 3))
      setValue(next)
      if (p < 1) frame = requestAnimationFrame(tick)
      else from.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return target == null ? null : value
}
