import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/** Tells the teacher when the device lost connection, so failed saves are not a surprise. */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  if (online) return null
  return <div className="banner banner-offline" role="status"><WifiOff size={16} aria-hidden /><span>Estás sin conexión. Puedes seguir mirando; los cambios se guardarán cuando vuelva internet.</span></div>
}
