'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface PresenceIndicatorProps {
  userId: string
  className?: string
}

interface UserPresence {
  user_id: string
  is_online: boolean
  last_seen: string
  created_at: string
  updated_at: string
}

const OFFLINE_THRESHOLD = 2 * 60 * 1000 // 2 minutes without updates means user is offline

export function PresenceIndicator({ userId, className }: PresenceIndicatorProps) {
  const [isOnline, setIsOnline] = useState(false)
  const { supabase } = useSupabase()

  const checkOnlineStatus = (presence: UserPresence | null) => {
    if (!presence) return false
    
    const lastSeen = new Date(presence.last_seen).getTime()
    const now = Date.now()
    return presence.is_online && (now - lastSeen) < OFFLINE_THRESHOLD
  }

  useEffect(() => {
    let checkInterval: NodeJS.Timeout

    // Initial presence check
    const checkPresence = async () => {
      const { data, error } = await supabase
        .from('user_presence')
        .select('is_online, last_seen')
        .eq('user_id', userId)
        .single()

      if (!error && data) {
        setIsOnline(checkOnlineStatus(data as UserPresence))
      }
    }

    checkPresence()

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<UserPresence>) => {
          const newPresence = payload.new as UserPresence
          if (newPresence) {
            setIsOnline(checkOnlineStatus(newPresence))
          }
        }
      )
      .subscribe()

    // Periodically check if the last_seen is too old
    checkInterval = setInterval(() => {
      supabase
        .from('user_presence')
        .select('is_online, last_seen')
        .eq('user_id', userId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setIsOnline(checkOnlineStatus(data as UserPresence))
          }
        })
    }, OFFLINE_THRESHOLD) // Check every 2 minutes

    return () => {
      clearInterval(checkInterval)
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  return (
    <div
      className={cn(
        'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background transition-colors duration-200',
        isOnline ? 'bg-green-500' : 'bg-gray-400',
        className
      )}
    />
  )
} 