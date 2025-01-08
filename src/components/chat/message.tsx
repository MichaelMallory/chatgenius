'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface MessageProps {
  id: string
  content: string
  username: string
  avatarUrl?: string
  createdAt: Date
  userId: string
  channelId: string
  onDelete?: (messageId: string) => void
}

export function Message({ 
  id,
  content,
  username,
  avatarUrl,
  createdAt,
  userId,
  channelId,
  onDelete
}: MessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const { user } = useSupabase()
  const isCurrentUser = user?.id === userId

  const handleEdit = async () => {
    if (!editedContent.trim()) return

    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: editedContent.trim() })
        .eq('id', id)
        .eq('user_id', user?.id)

      if (error) throw error

      setIsEditing(false)
    } catch (error) {
      console.error('Error updating message:', error)
      toast.error('Failed to update message. Please try again.')
    }
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id)

      if (error) throw error

      onDelete?.(id)
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message. Please try again.')
    }
  }

  return (
    <div className={cn(
      "flex gap-3 p-4 hover:bg-muted/50 transition-colors group",
      isCurrentUser && "flex-row-reverse"
    )}>
      <Avatar>
        <AvatarImage src={avatarUrl} />
        <AvatarFallback>{username[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className={cn(
        "flex flex-col gap-1 flex-1",
        isCurrentUser && "items-end"
      )}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{username}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
          {isCurrentUser && !isEditing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
                title="Edit message"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Delete message"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Message</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this message? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setEditedContent(content)
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEdit}
                disabled={!editedContent.trim() || editedContent === content}
              >
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn(
            "text-sm prose prose-sm dark:prose-invert max-w-none",
            isCurrentUser && "text-right"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
} 