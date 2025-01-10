'use client'

import { createContext, useContext, useEffect, useCallback, useRef } from 'react'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { User } from '@supabase/supabase-js'

const ACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const DEBOUNCE_DELAY = 1000 // 1 second debounce

interface PresenceContextType {
  updatePresence: () => void
}

export const PresenceContext = createContext<PresenceContextType>({
  updatePresence: () => {},
})

export function usePresence() {
  return useContext(PresenceContext)
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const userRef = useRef<User | null>(null)
  const activityTimeoutRef = useRef<NodeJS.Timeout>()
  const updateTimeoutRef = useRef<NodeJS.Timeout>()

  // Debounced presence update
  const updatePresence = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    updateTimeoutRef.current = setTimeout(async () => {
      if (!userRef.current?.id) return

      await supabase
        .from('user_presence')
        .upsert({
          user_id: userRef.current.id,
          last_seen: new Date().toISOString(),
          is_online: true
        }, {
          onConflict: 'user_id'
        })
    }, DEBOUNCE_DELAY)
  }, [supabase])

  useEffect(() => {
    let mounted = true

    // Get initial user and store in ref
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (mounted) {
        userRef.current = user
        if (user) {
          updatePresence()
        }
      }
    }
    initUser()

    const handleActivity = () => {
      if (!userRef.current) return

      // Clear existing timeout
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
      }

      // Update presence (debounced)
      updatePresence()

      // Set new timeout for inactivity
      activityTimeoutRef.current = setTimeout(async () => {
        if (!userRef.current?.id) return
        
        await supabase
          .from('user_presence')
          .update({ is_online: false })
          .eq('user_id', userRef.current.id)
      }, ACTIVITY_TIMEOUT)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity()
      }
    }

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      userRef.current = session?.user ?? null
      
      if (event === 'SIGNED_IN' && session?.user) {
        updatePresence()
      }
      if (event === 'SIGNED_OUT' && userRef.current?.id) {
        await supabase
          .from('user_presence')
          .update({ is_online: false })
          .eq('user_id', userRef.current.id)
        userRef.current = null
      }
    })

    // Set up event listeners with passive option for better performance
    window.addEventListener('mousemove', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('click', handleActivity, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      subscription.unsubscribe()
    }
  }, [supabase, updatePresence])

  return (
    <PresenceContext.Provider value={{ updatePresence }}>
      {children}
    </PresenceContext.Provider>
  )
} 