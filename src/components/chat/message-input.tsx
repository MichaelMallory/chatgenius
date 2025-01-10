'use client'

import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bold, Italic, Code, Send, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/components/providers/supabase-provider'
import { toast } from 'sonner'
import { EmojiPicker } from './emoji-picker'
import { User } from '@supabase/supabase-js'

interface MessageInputProps {
  channelId: string
  className?: string
  parentId?: string
}

export function MessageInput({ channelId, className, parentId }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    // Limit total size to 50MB
    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0)
    if (totalSize > 50 * 1024 * 1024) {
      toast.error('Total file size cannot exceed 50MB')
      return
    }
    setFiles(selectedFiles)
  }

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0) return
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

      // Upload files first if any
      const uploadedFiles = []
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `${channelId}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(filePath, file)

          if (uploadError) {
            console.error('Error uploading file:', uploadError)
            toast.error(`Failed to upload ${file.name}`)
            return
          }

          const { data: { publicUrl } } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath)

          uploadedFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            url: publicUrl
          })
        }
      }

      // Create message with file references
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          content: content.trim(),
          channel_id: channelId,
          user_id: user.id,
          parent_id: parentId,
          files: uploadedFiles
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
      setFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-muted/50 rounded-md p-2 text-sm"
            >
              <span className="truncate max-w-[200px]">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={() => setFiles(files.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
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
          disabled={(!content.trim() && files.length === 0) || isSubmitting}
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