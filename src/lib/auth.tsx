import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './supabase'

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string | undefined) {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // nevolať await priamo v callbacku (odporúčanie Supabase)
      setTimeout(() => { loadProfile(s?.user.id) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    loading,
    session,
    profile,
    isAdmin: profile?.role === 'admin',
    signIn: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    },
    signOut: async () => { await supabase.auth.signOut() },
    refreshProfile: async () => { await loadProfile(session?.user.id) },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musí byť vnútri AuthProvider')
  return ctx
}
