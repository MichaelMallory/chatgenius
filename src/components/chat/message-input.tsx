'use client'

import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bold, Italic, Code, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/components/providers/supabase-provider'
import { toast } from 'sonner'
import { EmojiPicker } from './emoji-picker'
import { User } from '@supabase/supabase-js'

interface MessageInputProps {
  channelId: string
  className?: string
}

export function MessageInput({ channelId, className }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { supabase } = useSupabase()

  // Get and track auth state
  useEffect(() => {
    let mounted = true
    
    const setupAuth = async () => {
      try {
        // Get initial auth state
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          setUser(session?.user ?? null)
        }

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
          if (mounted) {
            setUser(session?.user ?? null)
          }
        })

        return () => {
          mounted = false
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error('Error setting up auth:', error)
        return () => {
          mounted = false
        }
      }
    }

    setupAuth()
  }, [supabase])

  const handleFormat = (format: 'bold' | 'italic' | 'code') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    let newText = ''

    switch (format) {
      case 'bold':
        newText = `**${selectedText}**`
        break
      case 'italic':
        newText = `_${selectedText}_`
        break
      case 'code':
        newText = `\`${selectedText}\``
        break
    }

    setContent(
      content.substring(0, start) + newText + content.substring(end)
    )
    
    // Reset focus to textarea
    textarea.focus()
  }

  const handleEmojiSelect = (emoji: any) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    setContent(
      content.substring(0, start) + emoji.native + content.substring(end)
    )

    // Reset focus to textarea
    textarea.focus()
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    if (!user) {
      toast.error('You must be logged in to send messages')
      return
    }
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      // First verify channel membership
      const { data: membership, error: membershipError } = await supabase
        .from('user_channels')
        .select('role')
        .eq('user_id', user.id)
        .eq('channel_id', channelId)
        .single()

      if (membershipError) {
        if (membershipError.code === 'PGRST116') {
          toast.error('You are not a member of this channel')
        } else {
          console.error('Error checking channel membership:', membershipError)
          toast.error('Failed to verify channel membership')
        }
        return
      }

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          content: content.trim(),
          channel_id: channelId,
          user_id: user.id
        })

      if (messageError) {
        if (messageError.code === '42501') {
          toast.error('You don\'t have permission to send messages in this channel')
        } else if (messageError.code === '23503') {
          toast.error('Channel not found')
        } else {
          console.error('Error sending message:', messageError)
          toast.error('Failed to send message')
        }
        return
      }

      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!user) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        You must be logged in to send messages
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleFormat('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleFormat('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleFormat('code')}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </Button>
        <EmojiPicker onEmojiSelect={handleEmojiSelect} />
      </div>
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[80px] resize-none"
          disabled={isSubmitting}
        />
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className="self-end"
        >
          {isSubmitting ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
} 