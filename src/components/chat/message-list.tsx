'use client'

import { useEffect, useState, useRef } from 'react'
import { Message } from './message'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import { ThreadView } from './thread-view'
import { cn } from '@/lib/utils'

interface MessageData {
  id: string
  content: string
  created_at: string
  user_id: string
  channel_id: string
  parent_id: string | null
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
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { supabase, user } = useSupabase()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Initial message load
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true)
        setError(null)

        if (!user) {
          setError('Please sign in to view messages')
          return
        }

        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            user_id,
            channel_id,
            parent_id,
            profiles!inner (
              username,
              avatar_url
            )
          `)
          .eq('channel_id', channelId)
          .is('parent_id', null)  // Only get top-level messages
          .order('created_at', { ascending: true })
          .limit(50)
          .returns<MessageData[]>()

        if (error) {
          console.error('Error loading messages:', error)
          setError('Failed to load messages')
          return
        }

        setMessages(data || [])
        // Scroll to bottom after messages load
        setTimeout(scrollToBottom, 100)
      } catch (error) {
        console.error('Error loading messages:', error)
        setError('An unexpected error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [channelId, user, supabase])

  // Scroll to bottom when channel changes
  useEffect(() => {
    scrollToBottom()
  }, [channelId])

  // Real-time message subscription
  useRealtime<MessageData>('messages', async (payload) => {
    if (!user) return // Don't process updates if not authenticated

    if (payload.eventType === 'INSERT' && payload.new.channel_id === channelId && !payload.new.parent_id) {
      // Only handle new top-level messages (no parent_id)
      // Fetch the complete message data including profile
      const { data: newMessage } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          channel_id,
          parent_id,
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
      // Scroll to bottom when new message arrives
      setTimeout(scrollToBottom, 100)
    } else if (payload.eventType === 'DELETE' && payload.old.channel_id === channelId) {
      setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
    } else if (payload.eventType === 'UPDATE' && payload.new.channel_id === channelId) {
      setMessages((prev) => prev.map((msg) => 
        msg.id === payload.new.id ? { ...msg, content: payload.new.content } : msg
      ))
    }
  }, {
    filter: `channel_id=eq.${channelId}`
  })

  const handleDelete = (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
  }

  const handleReply = (messageId: string) => {
    setActiveThreadId(messageId)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className={cn(
        "flex-1 flex flex-col gap-2 p-4",
        activeThreadId && "border-r"
      )}>
        {messages.map((message) => (
          <Message
            key={message.id}
            id={message.id}
            content={message.content}
            username={message.profiles.username}
            avatarUrl={message.profiles.avatar_url || undefined}
            createdAt={new Date(message.created_at)}
            userId={message.user_id}
            channelId={message.channel_id}
            onDelete={handleDelete}
            onReply={handleReply}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      {activeThreadId && (
        <div className="w-[400px]">
          <ThreadView
            parentMessageId={activeThreadId}
            channelId={channelId}
            onClose={() => setActiveThreadId(null)}
          />
        </div>
      )}
    </div>
  )
} 