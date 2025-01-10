'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Message } from './message'
import { MessageInput } from './message-input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ThreadViewProps {
  parentMessageId: string
  channelId: string
  onClose: () => void
}

interface Profile {
  username: string
  avatar_url: string | null
}

interface ThreadMessage {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: Profile
}

interface DatabaseMessage {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: {
    username: string
    avatar_url: string | null
  }
}

export function ThreadView({ parentMessageId, channelId, onClose }: ThreadViewProps) {
  const { supabase } = useSupabase()
  const [parentMessage, setParentMessage] = useState<ThreadMessage | null>(null)
  const [replies, setReplies] = useState<ThreadMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadThread = async () => {
      try {
        setIsLoading(true)

        // Load parent message
        const { data: parentData, error: parentError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            user_id,
            created_at,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .eq('id', parentMessageId)
          .single<DatabaseMessage>()

        if (parentError) throw parentError
        if (!parentData) throw new Error('Parent message not found')
        setParentMessage(parentData)

        // Load replies
        const { data: repliesData, error: repliesError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            user_id,
            created_at,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .eq('parent_id', parentMessageId)
          .order('created_at', { ascending: true })
          .returns<DatabaseMessage[]>()

        if (repliesError) throw repliesError
        if (!repliesData) throw new Error('Failed to load replies')
        setReplies(repliesData)
      } catch (error) {
        console.error('Error loading thread:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadThread()

    // Subscribe to new replies
    const channel = supabase
      .channel('thread-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `parent_id=eq.${parentMessageId}`,
        },
        () => {
          loadThread()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [supabase, parentMessageId])

  const handleDeleteReply = (messageId: string) => {
    setReplies(prev => prev.filter(reply => reply.id !== messageId))
  }

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Thread</h3>
          {parentMessage && (
            <span className="text-sm text-muted-foreground">
              with {parentMessage.profiles.username}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {parentMessage && (
          <div className="p-4 border-b bg-muted/50">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={parentMessage.profiles.avatar_url || undefined} />
                <AvatarFallback>{parentMessage.profiles.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{parentMessage.profiles.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(parentMessage.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm">{parentMessage.content}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          {replies.map((reply) => (
            <Message
              key={reply.id}
              id={reply.id}
              content={reply.content}
              username={reply.profiles.username}
              avatarUrl={reply.profiles.avatar_url || undefined}
              createdAt={new Date(reply.created_at)}
              userId={reply.user_id}
              channelId={channelId}
              onDelete={handleDeleteReply}
            />
          ))}
        </div>
      </div>

      <div className="p-4 border-t">
        <MessageInput channelId={channelId} parentId={parentMessageId} />
      </div>
    </div>
  )
} 