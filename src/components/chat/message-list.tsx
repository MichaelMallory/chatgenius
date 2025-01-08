'use client'

import { useEffect, useState } from 'react'
import { Message } from './message'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'

interface MessageData {
  id: string
  content: string
  created_at: string
  user_id: string
  channel_id: string
  profiles: {
    username: string
    avatar_url: string | null
  }
}

interface MessageListProps {
  channelId: string
}

export function MessageList({ channelId }: MessageListProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const { user } = useSupabase()

  // Initial message load
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          channel_id,
          profiles!inner (
            username,
            avatar_url
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(50)
        .returns<MessageData[]>()

      if (error) {
        console.error('Error loading messages:', error)
        return
      }

      setMessages(data || [])
    }

    loadMessages()
  }, [channelId])

  // Real-time message subscription
  useRealtime<MessageData>('messages', async (payload) => {
    if (payload.eventType === 'INSERT' && payload.new.channel_id === channelId) {
      // Fetch the complete message data including profile
      const { data: newMessage } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          channel_id,
          profiles!inner (
            username,
            avatar_url
          )
        `)
        .eq('id', payload.new.id)
        .returns<MessageData[]>()
        .single()

      if (!newMessage) {
        console.error('Error fetching new message')
        return
      }

      setMessages((prev) => {
        const updated = [...prev, newMessage]
        return updated.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    }
  }, {
    filter: `channel_id=eq.${channelId}`
  })

  return (
    <div className="flex flex-col gap-2 p-4">
      {messages.map((message) => (
        <Message
          key={message.id}
          content={message.content}
          username={message.profiles.username}
          avatarUrl={message.profiles.avatar_url || undefined}
          createdAt={new Date(message.created_at)}
          isCurrentUser={message.user_id === user?.id}
        />
      ))}
    </div>
  )
} 