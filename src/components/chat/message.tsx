'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pencil, Trash2, X, Check, MessageSquare } from 'lucide-react'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { MessageReactions } from './message-reactions'
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
  className?: string
  onDelete?: (messageId: string) => void
  onReply?: (messageId: string, event: React.MouseEvent<HTMLButtonElement>) => void
}

export function Message({ 
  id,
  content,
  username,
  avatarUrl,
  createdAt,
  userId,
  channelId,
  className,
  onDelete,
  onReply
}: MessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const [replyCount, setReplyCount] = useState(0)
  const { supabase } = useSupabase()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const isCurrentUser = currentUser === userId

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user?.id ?? null)
    }
    getUser()
  }, [supabase])

  // Load reply count
  useEffect(() => {
    const loadReplyCount = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', id)

      if (error) {
        console.error('Error loading reply count:', error)
        return
      }

      setReplyCount(count || 0)
    }

    loadReplyCount()
  }, [id])

  const handleEdit = async () => {
    if (!editedContent.trim()) return

    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: editedContent.trim() })
        .eq('id', id)
        .eq('user_id', currentUser)

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
        .eq('user_id', currentUser)

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
      className
    )}>
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback>{username[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 flex-1">
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
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
            <div className="flex items-center gap-2">
              <MessageReactions
                messageId={id}
                channelId={channelId}
                className="mt-2"
              />
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-muted/80 dark:hover:bg-muted/50"
                )}
                onClick={(e) => onReply?.(id, e)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Reply
              </Button>
            </div>
            {replyCount > 0 && (
              <Button
                variant="link"
                size="sm"
                className="h-6 px-0 text-sm text-muted-foreground hover:text-foreground"
                onClick={(e) => onReply?.(id, e)}
              >
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 