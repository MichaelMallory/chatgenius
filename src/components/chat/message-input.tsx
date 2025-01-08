'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bold, Italic, Code, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { EmojiPicker } from './emoji-picker'

interface MessageInputProps {
  channelId: string
  className?: string
}

export function MessageInput({ channelId, className }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { user } = useSupabase()

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
    if (!content.trim() || !user || isSubmitting) {
      console.log('Submit validation failed:', { 
        hasContent: !!content.trim(), 
        hasUser: !!user, 
        isSubmitting,
        userId: user?.id,
        channelId
      })
      return
    }

    setIsSubmitting(true)
    try {
      // First verify channel membership
      const { data: membership, error: membershipError } = await supabase
        .from('user_channels')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel_id', channelId)
        .single()

      console.log('Channel membership check:', { membership, error: membershipError })

      if (membershipError) {
        throw new Error('You are not a member of this channel')
      }

      console.log('Attempting to send message:', {
        content: content.trim(),
        channel_id: channelId,
        user_id: user.id
      })

      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: content.trim(),
          channel_id: channelId,
          user_id: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Message sent successfully:', data)
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send message. Please try again.')
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