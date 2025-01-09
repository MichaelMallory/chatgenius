import { useEffect } from 'react'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Table = 'messages' | 'channels' | 'reactions' | 'user_channels' | 'files' | 'profiles'
type Event = 'INSERT' | 'UPDATE' | 'DELETE'

interface UseRealtimeOptions {
  event?: Event | '*'
  filter?: string
  schema?: string
}

export function useRealtime<T extends { [key: string]: any }>(
  table: Table,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  options: UseRealtimeOptions = {}
) {
  useEffect(() => {
    const { event = '*', filter, schema = 'public' } = options
    let channel: RealtimeChannel

    try {
      console.log(`Setting up real-time subscription for ${table}:`, {
        event,
        filter,
        schema
      })

      channel = supabase
        .channel(`${table}_changes`)
        .on<T>(
          'postgres_changes' as any,
          {
            event,
            schema,
            table,
            filter,
          },
          (payload: RealtimePostgresChangesPayload<T>) => {
            console.log(`Received ${table} update:`, {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              filter
            })
            callback(payload)
          }
        )
        .subscribe((status) => {
          console.log(`Subscription status for ${table}:`, status)
        })
    } catch (error) {
      console.error(`Error subscribing to ${table}:`, error)
    }

    return () => {
      if (channel) {
        console.log(`Cleaning up subscription for ${table}`)
        supabase.removeChannel(channel)
      }
    }
  }, [table, callback, options])
}

// Presence hook for user online status
export function usePresence(channelId: string, userId: string) {
  useEffect(() => {
    let channel: RealtimeChannel

    try {
      channel = supabase.channel(`presence_${channelId}`, {
        config: {
          presence: {
            key: userId,
          },
        },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          console.log('Presence state:', state)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('Join:', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('Leave:', key, leftPresences)
        })
        .subscribe()
    } catch (error) {
      console.error('Error setting up presence:', error)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [channelId, userId])
}

// Example usage:
/*
// Subscribe to all message changes
useRealtime<Message>('messages', (payload) => {
  console.log('Message change:', payload)
})

// Subscribe to specific channel messages
useRealtime<Message>('messages', (payload) => {
  console.log('Channel message:', payload)
}, {
  filter: `channel_id=eq.${channelId}`
})

// Track user presence in a channel
usePresence(channelId, userId)
*/ 