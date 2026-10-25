import { useEffect, useState } from 'react'
import FairTeamMark from './FairTeamMark'

type ExperiencePreloaderProps = { progress: number; exiting?: boolean }

export default function ExperiencePreloader({ progress, exiting = false }: ExperiencePreloaderProps) {
  return <div className={`experience-preloader${exiting ? ' is-exiting' : ''}`} role="status" aria-live="polite" aria-label={`Cargando FairTeam, ${progress}%`}>
    <div className="preloader-content">
      <div className="preloader-mark"><FairTeamMark size={54}/></div>
      <span className="preloader-wordmark">fair<span>team</span></span>
      <div className="preloader-progress-track"><span style={{ width: `${progress}%` }}/></div>
      <div className="preloader-meta"><span>PREPARANDO TU ESPACIO DOCENTE</span><b>{progress}%</b></div>
    </div>
  </div>
}

export function useExperiencePreloader() {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem('fairteam.intro.seen'))
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!visible) return
    let ready = document.readyState === 'complete'
    let value = 0
    let finishTimer = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const progressTimer = window.setInterval(() => {
      const next = ready ? Math.min(100, value + (reducedMotion ? 20 : 4)) : Math.min(92, value + 2)
      value = next
      setProgress(next)
      if (ready && next === 100) {
        window.clearInterval(progressTimer)
        setExiting(true)
        finishTimer = window.setTimeout(() => {
          sessionStorage.setItem('fairteam.intro.seen', 'true')
          setVisible(false)
        }, reducedMotion ? 80 : 720)
      }
    }, reducedMotion ? 20 : 28)
    const onLoad = () => { ready = true }
    if (!ready) window.addEventListener('load', onLoad, { once: true })
    return () => {
      window.clearInterval(progressTimer)
      window.clearTimeout(finishTimer)
      window.removeEventListener('load', onLoad)
    }
  }, [visible])

  return { visible, progress, exiting }
}
