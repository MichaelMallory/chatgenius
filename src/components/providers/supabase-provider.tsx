'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type SupabaseContextType = {
  user: User | null
  loading: boolean
}

const SupabaseContext = createContext<SupabaseContextType>({
  user: null,
  loading: true,
})

export const useSupabase = () => useContext(SupabaseContext)

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check active sessions and sets the user
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('Initial auth check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          error: sessionError
        })

        if (sessionError) throw sessionError
        
        setUser(session?.user ?? null)
        setLoading(false)

        if (session?.user) {
          // Verify user has necessary data
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          console.log('Profile check:', {
            hasProfile: !!profile,
            error: profileError
          })

          if (profileError) {
            // Try to create profile
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                username: session.user.email?.split('@')[0] || 'user',
                full_name: session.user.email?.split('@')[0] || 'User'
              })

            console.log('Profile creation attempt:', {
              error: createError
            })
          }
        }
      } catch (error) {
        console.error('Error in auth initialization:', error)
        setLoading(false)
      }
    }

    initAuth()

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', {
        event,
        userId: session?.user?.id
      })

      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SupabaseContext.Provider value={{ user, loading }}>
      {children}
    </SupabaseContext.Provider>
  )
} 