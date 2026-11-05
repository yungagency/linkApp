import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Profile, Vitrine } from './types'

interface Session {
  profile: Profile | null
  vitrine: Vitrine | null
  loading: boolean
  refresh: () => Promise<void>
}

const Ctx = createContext<Session>({ profile: null, vitrine: null, loading: true, refresh: async () => {} })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [vitrine, setVitrine] = useState<Vitrine | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const p = await api.getProfile()
      setProfile(p)
      setVitrine(p ? await api.myVitrine() : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    return api.onAuthChange(() => { refresh() })
  }, [refresh])

  return <Ctx.Provider value={{ profile, vitrine, loading, refresh }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)

/** Favoris : gardés sur l'appareil (pas besoin de compte pour un visiteur). */
const FAV = 'linkapp-favs'
export function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV) || '[]') } catch { return [] }
}
export function toggleFav(id: string): string[] {
  const s = new Set(getFavs())
  if (s.has(id)) s.delete(id)
  else s.add(id)
  const a = [...s]
  try { localStorage.setItem(FAV, JSON.stringify(a)) } catch { /* ignore */ }
  return a
}
