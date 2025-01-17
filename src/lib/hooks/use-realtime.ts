import { useEffect, useMemo } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Table = 'messages' | 'channels' | 'reactions' | 'user_channels' | 'files' | 'profiles';
type Event = 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeOptions {
  event?: Event | '*';
  filter?: string;
  schema?: string;
}

export function useRealtime<T extends { [key: string]: any }>(
  table: Table,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  options: UseRealtimeOptions = {}
) {
  const { event = '*', filter, schema = 'public' } = options;

  // Memoize the options to prevent unnecessary re-renders
  const channelOptions = useMemo(
    () => ({
      event,
      schema,
      table,
      filter,
    }),
    [event, schema, table, filter]
  );

  useEffect(() => {
    let channel: RealtimeChannel;

    try {
      channel = supabase
        .channel(`${table}_changes`)
        .on<T>('postgres_changes' as any, channelOptions, callback)
        .subscribe();
    } catch (error) {
      console.error(`Error subscribing to ${table}:`, error);
    }

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [table, callback, channelOptions]);
}

// Presence hook for user online status
export function usePresence(channelId: string, userId: string) {
  useEffect(() => {
    let channel: RealtimeChannel;

    try {
      channel = supabase.channel(`presence_${channelId}`, {
        config: {
          presence: {
            key: userId,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          if (process.env.NODE_ENV === 'development') {
            console.log('Presence state:', state);
          }
        })
        .subscribe();
    } catch (error) {
      console.error('Error setting up presence:', error);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [channelId, userId]);
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
