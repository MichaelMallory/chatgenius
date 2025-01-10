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
  files: {
    name: string
    size: number
    type: string
    url: string
  }[]
  profiles: {
    username: string
    avatar_url: string | null
  }
}

interface ThreadPosition {
  messageId: string
  top: number
  right: number
}

interface MessageListProps {
  channelId: string
}

export function MessageList({ channelId }: MessageListProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [activeThread, setActiveThread] = useState<ThreadPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { supabase, user } = useSupabase()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout>()

  const scrollToBottom = () => {
    // First scroll instantly
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    // Then do a final scroll after a longer delay to catch any late updates
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      // One final scroll to absolutely ensure we're at the bottom
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      })
    }, 1000)
  }

  // Initial message load
  useEffect(() => {
    const loadMessages = async () => {
      try {
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
            files,
            profiles!inner (
              username,
              avatar_url
            )
          `)
          .eq('channel_id', channelId)
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .limit(50)
          .returns<MessageData[]>()

        if (error) {
          console.error('Error loading messages:', error)
          setError('Failed to load messages')
          return
        }

        setMessages((data || []).reverse())
        
        // Set a timeout to scroll to bottom after components load
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }
        loadingTimeoutRef.current = setTimeout(scrollToBottom, 3000)

      } catch (error) {
        console.error('Error loading messages:', error)
        setError('An unexpected error occurred')
      }
    }

    loadMessages()

    // Cleanup timeout on unmount or channel change
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [channelId, user, supabase])

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
          files,
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
        // Add new message at the end since it's the newest
        return [...prev, newMessage]
      })
      // Scroll to bottom when new message arrives
      scrollToBottom()
    } else if (payload.eventType === 'DELETE' && payload.old.channel_id === channelId) {
      setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
    } else if (payload.eventType === 'UPDATE' && payload.new.channel_id === channelId) {
      setMessages((prev) => prev.map((msg) => 
        msg.id === payload.new.id ? { ...msg, content: payload.new.content, files: payload.new.files } : msg
      ))
    }
  }, {
    filter: `channel_id=eq.${channelId}`
  })

  const handleDelete = (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
  }

  const handleReply = (messageId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const messageElement = event.currentTarget.closest('.message-item')
    if (!messageElement) return

    const listRect = messageListRef.current?.getBoundingClientRect()
    if (!listRect) return

    // If clicking the same thread, close it
    if (activeThread?.messageId === messageId) {
      setActiveThread(null)
      return
    }

    // Calculate position relative to the viewport
    const viewportHeight = window.innerHeight
    const threadHeight = Math.min(viewportHeight - 100, 600) // Max height of thread view
    const top = Math.max(20, (viewportHeight - threadHeight) / 2) // Center in viewport with min padding

    setActiveThread({ messageId, top, right: listRect.width })
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full relative" ref={messageListRef}>
      <div className="flex-1 flex flex-col gap-2 p-4 relative overflow-y-auto">
        <div className="flex-1" /> {/* Spacer to push messages to bottom */}
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
            files={message.files}
            onDelete={handleDelete}
            onReply={handleReply}
            className="message-item"
          />
        ))}
        <div ref={messagesEndRef} className="h-0" />
      </div>
      {activeThread && (
        <div 
          className={cn(
            "fixed w-[400px] bg-background border shadow-lg rounded-lg",
            "transition-all duration-200 ease-in-out opacity-0 translate-x-2",
            "data-[state=open]:opacity-100 data-[state=open]:translate-x-0"
          )}
          style={{ 
            top: `${activeThread.top}px`,
            right: '20px',
            maxHeight: 'calc(100vh - 100px)',
            transform: 'translateZ(0)'
          }}
          data-state="open"
        >
          <ThreadView
            parentMessageId={activeThread.messageId}
            channelId={channelId}
            onClose={() => setActiveThread(null)}
          />
        </div>
      )}
    </div>
  )
} 