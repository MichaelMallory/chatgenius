'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

interface SupabaseContextType {
  supabase: typeof supabase
  user: User | null
  isLoading: boolean
}

export const SupabaseContext = createContext<SupabaseContextType>({
  supabase,
  user: null,
  isLoading: true,
})

export function useSupabase() {
  return useContext(SupabaseContext)
}

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    // Check active session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (mounted) {
          setUser(session?.user ?? null)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error checking session:', error)
        if (mounted) {
          setUser(null)
          setIsLoading(false)
        }
      }
    }

    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        
        if (event === 'SIGNED_OUT') {
          router.push('/sign-in')
        }
        if (event === 'SIGNED_IN') {
          router.refresh()
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <SupabaseContext.Provider value={{ supabase, user, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  )
} 