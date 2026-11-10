import { useEffect, useRef, useState } from 'react'
import { SPOTS, SPOT_EVENT, findTarget } from '../lib/guide'

/** A pulsing ring around the control Búho is talking about; it fades after a while or on the first click. */
export default function Spotlight() {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const target = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let timers: number[] = []
    const clear = () => { timers.forEach(t => window.clearTimeout(t)); timers = []; target.current = null; setRect(null) }
    const onSpot = (event: Event) => {
      clear()
      const targets = SPOTS[(event as CustomEvent<string>).detail]
      if (!targets) return
      let tries = 0
      const look = () => {
        const element = findTarget(targets)
        if (element) {
          target.current = element
          element.scrollIntoView({ block: 'center', behavior: 'smooth' })
          timers.push(window.setTimeout(() => setRect(element.getBoundingClientRect()), 350))
          timers.push(window.setTimeout(clear, 7000))
        } else if (++tries < 30) timers.push(window.setTimeout(look, 150))
      }
      timers.push(window.setTimeout(look, 250))
    }
    const follow = () => { if (target.current?.isConnected) setRect(target.current.getBoundingClientRect()) }
    const onClick = () => { if (target.current) window.setTimeout(clear, 200) }
    window.addEventListener(SPOT_EVENT, onSpot)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    window.addEventListener('pointerdown', onClick, true)
    return () => { clear(); window.removeEventListener(SPOT_EVENT, onSpot); window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow); window.removeEventListener('pointerdown', onClick, true) }
  }, [])

  if (!rect) return null
  return <div className="guide-ring is-spot" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} aria-hidden />
}
