import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { toast } from './ui'

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: BIPEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent })

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Bouton « Installer » : Android/ordinateur via l'invite native, iPhone via les instructions Safari. */
export function InstallButton() {
  const [can, setCan] = useState(!!deferred || (isIOS() && !standalone()))
  useEffect(() => {
    const on = () => setCan(true)
    const done = () => setCan(false)
    window.addEventListener('beforeinstallprompt', on)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done) }
  }, [])
  if (!can || standalone()) return null
  return (
    <button className="btn soft sm" onClick={async () => {
      if (deferred) {
        await deferred.prompt()
        await deferred.userChoice
        deferred = null
        setCan(false)
      } else {
        toast('Sur iPhone : touchez Partager, puis « Sur l’écran d’accueil »')
      }
    }}>
      <Icon name="download" size={16} />Installer
    </button>
  )
}
