'use client'

import { useEffect, useState } from 'react'
import { Message } from './message'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import { MessageInput } from './message-input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThreadViewProps {
  parentMessageId: string
  channelId: string
  onClose: () => void
}

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

interface DatabaseMessage {
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

export function ThreadView({ parentMessageId, channelId, onClose }: ThreadViewProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [parentMessage, setParentMessage] = useState<MessageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load parent message and thread messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Load parent message
        const { data: parentData, error: parentError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            user_id,
            channel_id,
            parent_id,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .eq('id', parentMessageId)
          .single<DatabaseMessage>()

        if (parentError) {
          console.error('Error loading parent message:', parentError)
          setError('Failed to load thread message')
          return
        }
        if (!parentData) {
          console.error('Parent message not found')
          setError('Message not found')
          return
        }
        if (!parentData.profiles) {
          console.error('Profile data is missing')
          setError('User profile not found')
          return
        }

        setParentMessage(parentData)

        // Load thread messages
        const { data: threadData, error: threadError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            user_id,
            channel_id,
            parent_id,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .eq('parent_id', parentMessageId)
          .order('created_at', { ascending: true })
          .returns<DatabaseMessage[]>()

        if (threadError) {
          console.error('Error loading thread messages:', threadError)
          setError('Failed to load thread replies')
          return
        }
        if (!threadData) {
          console.error('Failed to load thread messages')
          setError('Failed to load thread replies')
          return
        }

        // Filter out messages without profiles
        const validMessages = threadData.filter((message): message is DatabaseMessage => 
          message.profiles !== null
        )
        setMessages(validMessages)
      } catch (error) {
        console.error('Error loading thread messages:', error)
        setError('An unexpected error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [parentMessageId])

  // Update real-time subscription query
  useRealtime<DatabaseMessage>('messages', async (payload) => {
    if (payload.eventType === 'INSERT' && payload.new.parent_id === parentMessageId) {
      // Fetch the complete message data including profile
      const { data: newMessage, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          channel_id,
          parent_id,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('id', payload.new.id)
        .single<DatabaseMessage>()

      if (error || !newMessage) {
        console.error('Error fetching new thread message:', error)
        return
      }

      if (!newMessage.profiles) {
        console.error('Profile data is missing for new message')
        return
      }

      setMessages((prev) => {
        const updated = [...prev, newMessage]
        return updated.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    } else if (payload.eventType === 'DELETE' && payload.old.parent_id === parentMessageId) {
      setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
    } else if (payload.eventType === 'UPDATE' && payload.new.parent_id === parentMessageId) {
      setMessages((prev) => prev.map((msg) => 
        msg.id === payload.new.id ? { ...msg, content: payload.new.content } : msg
      ))
    }
  }, {
    filter: `parent_id=eq.${parentMessageId}`
  })

  const handleSendMessage = async (content: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('messages')
        .insert({
          content,
          user_id: user.id,
          channel_id: channelId,
          parent_id: parentMessageId
        })

      if (error) throw error
    } catch (error) {
      console.error('Error sending thread message:', error)
    }
  }

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full border-l">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Thread</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !parentMessage) {
    return (
      <div className="flex flex-col h-full border-l">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Thread</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 p-4">
          <div className="text-center text-muted-foreground">
            {error || 'Failed to load thread'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Thread</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b bg-muted/50">
          {parentMessage && parentMessage.profiles && (
            <Message
              id={parentMessage.id}
              content={parentMessage.content}
              username={parentMessage.profiles.username}
              avatarUrl={parentMessage.profiles.avatar_url ?? undefined}
              createdAt={new Date(parentMessage.created_at)}
              userId={parentMessage.user_id}
              channelId={parentMessage.channel_id}
              onDelete={handleDeleteMessage}
            />
          )}
        </div>
        <div className="flex flex-col">
          {messages.map((message) => (
            message.profiles && (
              <Message
                key={message.id}
                id={message.id}
                content={message.content}
                username={message.profiles.username}
                avatarUrl={message.profiles.avatar_url ?? undefined}
                createdAt={new Date(message.created_at)}
                userId={message.user_id}
                channelId={message.channel_id}
                onDelete={handleDeleteMessage}
              />
            )
          ))}
        </div>
      </div>
      <div className="p-4 border-t">
        <MessageInput channelId={channelId} parentId={parentMessageId} />
      </div>
    </div>
  )
} 