import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmojiPicker } from './emoji-picker'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
  userIds: string[] // Track who has reacted
}

interface MessageReactionsProps {
  messageId: string
  channelId: string
  className?: string
}

export function MessageReactions({ messageId, channelId, className }: MessageReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useSupabase()

  // Load initial reactions
  useEffect(() => {
    const loadReactions = async () => {
      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from('reactions')
          .select('emoji, user_id')
          .eq('message_id', messageId)

        if (error) {
          console.error('Error loading reactions:', error)
          toast.error('Failed to load reactions')
          return
        }

        // Group reactions by emoji and track who has reacted
        const reactionCounts = (data || []).reduce((acc: { [key: string]: Reaction }, reaction) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = {
              emoji: reaction.emoji,
              count: 0,
              reacted: false,
              userIds: []
            }
          }
          // Only count if this user hasn't already reacted with this emoji
          if (!acc[reaction.emoji].userIds.includes(reaction.user_id)) {
            acc[reaction.emoji].count++
            acc[reaction.emoji].userIds.push(reaction.user_id)
            if (user?.id && reaction.user_id === user.id) {
              acc[reaction.emoji].reacted = true
            }
          }
          return acc
        }, {})

        setReactions(Object.values(reactionCounts))
      } catch (error) {
        console.error('Error in loadReactions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadReactions()
  }, [messageId, user?.id])

  // Real-time reaction updates
  useRealtime<{ emoji: string; user_id: string; message_id: string }>(
    'reactions',
    (payload) => {
      console.log('Reaction update received:', payload)

      if (!user?.id) return

      // For INSERT events
      if (payload.eventType === 'INSERT' && payload.new.message_id === messageId) {
        setReactions((prev) => {
          const existing = prev.find((r) => r.emoji === payload.new.emoji)
          if (existing) {
            // Only update if this user hasn't already reacted
            if (!existing.userIds.includes(payload.new.user_id)) {
              return prev.map((r) =>
                r.emoji === payload.new.emoji
                  ? {
                      ...r,
                      count: r.count + 1,
                      reacted: payload.new.user_id === user.id,
                      userIds: [...r.userIds, payload.new.user_id]
                    }
                  : r
              )
            }
            return prev
          } else {
            return [
              ...prev,
              {
                emoji: payload.new.emoji,
                count: 1,
                reacted: payload.new.user_id === user.id,
                userIds: [payload.new.user_id]
              }
            ]
          }
        })
      }
      
      // For DELETE events
      if (payload.eventType === 'DELETE' && payload.old && 'message_id' in payload.old) {
        const oldPayload = payload.old as { emoji: string; user_id: string; message_id: string }
        if (oldPayload.message_id !== messageId) return

        setReactions((prev) =>
          prev.map((r) =>
            r.emoji === oldPayload.emoji && r.userIds.includes(oldPayload.user_id)
              ? {
                  ...r,
                  count: r.count - 1,
                  reacted: oldPayload.user_id === user.id ? false : r.reacted,
                  userIds: r.userIds.filter(id => id !== oldPayload.user_id)
                }
              : r
          ).filter((r) => r.count > 0)
        )
      }
    },
    {
      filter: `message_id=eq.${messageId}`,
      event: '*'
    }
  )

  const handleReaction = async (emoji: { native: string }) => {
    if (!user) {
      toast.error('You must be logged in to react to messages')
      return
    }

    try {
      const existingReaction = reactions.find((r) => r.emoji === emoji.native && r.reacted)

      if (existingReaction) {
        // Optimistically update UI for removal
        setReactions((prev) =>
          prev.map((r) =>
            r.emoji === emoji.native
              ? {
                  ...r,
                  count: r.count - 1,
                  reacted: false,
                  userIds: r.userIds.filter(id => id !== user.id)
                }
              : r
          ).filter((r) => r.count > 0)
        )

        // Remove reaction
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji.native)

        if (error) {
          // Revert optimistic update on error
          setReactions((prev) =>
            prev.map((r) =>
              r.emoji === emoji.native
                ? {
                    ...r,
                    count: r.count + 1,
                    reacted: true,
                    userIds: [...r.userIds, user.id]
                  }
                : r
            )
          )

          console.error('Error removing reaction:', {
            error,
            messageId,
            userId: user.id,
            emoji: emoji.native,
            type: error.code,
            message: error.message,
            details: error.details
          })
          
          if (error.code === 'PGRST301') {
            toast.error('You can only remove your own reactions')
          } else if (error.code === '42501') {
            toast.error('You don\'t have permission to remove this reaction')
          } else {
            toast.error(`Failed to remove reaction: ${error.message}`)
          }
          return
        }
      } else {
        // Check if user has already reacted with this emoji
        const hasReacted = reactions.some(r => 
          r.emoji === emoji.native && r.userIds.includes(user.id)
        )

        if (hasReacted) {
          toast.error('You\'ve already added this reaction')
          return
        }

        // Optimistically update UI for adding
        setReactions((prev) => {
          const existing = prev.find((r) => r.emoji === emoji.native)
          if (existing) {
            return prev.map((r) =>
              r.emoji === emoji.native
                ? {
                    ...r,
                    count: r.count + 1,
                    reacted: true,
                    userIds: [...r.userIds, user.id]
                  }
                : r
            )
          } else {
            return [
              ...prev,
              {
                emoji: emoji.native,
                count: 1,
                reacted: true,
                userIds: [user.id]
              }
            ]
          }
        })

        // Add reaction
        const { error } = await supabase
          .from('reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji.native
          })

        if (error) {
          // Revert optimistic update on error
          setReactions((prev) =>
            prev.map((r) =>
              r.emoji === emoji.native
                ? {
                    ...r,
                    count: Math.max(0, r.count - 1),
                    reacted: false,
                    userIds: r.userIds.filter(id => id !== user.id)
                  }
                : r
            ).filter((r) => r.count > 0)
          )

          console.error('Error adding reaction:', {
            error,
            messageId,
            userId: user.id,
            emoji: emoji.native,
            type: error.code,
            message: error.message,
            details: error.details
          })
          
          if (error.code === '23505') {
            toast.error('You\'ve already added this reaction')
          } else if (error.code === '42501') {
            toast.error('You don\'t have permission to react to this message')
          } else {
            toast.error(`Failed to add reaction: ${error.message}`)
          }
          return
        }
      }
    } catch (error) {
      console.error('Error handling reaction:', {
        error,
        messageId,
        userId: user.id,
        emoji: emoji.native,
        type: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error)
      })
      toast.error('Failed to update reaction. Please try again.')
    }
  }

  if (isLoading) {
    return null // Or a loading skeleton if you prefer
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant={reaction.reacted ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "h-6 px-2 text-sm transition-colors",
            reaction.reacted 
              ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 dark:text-blue-400" // Blue highlight for user's reactions
              : "bg-muted hover:bg-muted/80 dark:bg-muted/30 dark:hover:bg-muted/50" // Darker background for other reactions
          )}
          onClick={() => handleReaction({ native: reaction.emoji })}
        >
          {reaction.emoji} {reaction.count}
        </Button>
      ))}
      <EmojiPicker onEmojiSelect={handleReaction} />
    </div>
  )
} 