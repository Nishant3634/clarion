import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, signOut: async () => {},
})

// A guest placeholder so the app works even when Supabase auth is unavailable
const GUEST_USER = {
  id: 'guest',
  email: 'guest@offline',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as unknown as User

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try Supabase auth, but fall back to guest mode if it fails
    const timeout = setTimeout(() => {
      // If auth hasn't resolved in 4 seconds, use guest mode
      if (loading) {
        console.warn('Supabase auth timeout — entering guest mode')
        setUser(GUEST_USER)
        setLoading(false)
      }
    }, 4000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      clearTimeout(timeout)
      console.warn('Supabase auth failed — entering guest mode')
      setUser(GUEST_USER)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // If Supabase is unreachable, just clear local state
    }
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
