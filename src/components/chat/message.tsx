'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Pencil,
  Trash2,
  X,
  Check,
  MessageSquare,
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File,
} from 'lucide-react';
import { useSupabase } from '@/components/providers/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { MessageReactions } from './message-reactions';
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
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import Image from 'next/image';

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface MessageProps {
  id: string;
  content: string;
  username: string;
  avatarUrl?: string;
  createdAt: Date;
  userId: string;
  channelId: string;
  files: FileAttachment[] | null;
  className?: string;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Helper function to get file icon
const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  if (type === 'application/pdf' || type.includes('document')) return FileText;
  return File;
};

export function Message({
  id,
  content,
  username,
  avatarUrl,
  createdAt,
  userId,
  channelId,
  files = null,
  className,
  onDelete,
  onReply,
}: MessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [replyCount, setReplyCount] = useState(0);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const { supabase } = useSupabase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const isCurrentUser = currentUser === userId;
  const messageRef = useRef<HTMLDivElement>(null);

  const getUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user?.id ?? null);
  }, [supabase.auth]);

  useEffect(() => {
    getUser();
  }, [getUser]);

  // Handle message highlighting and reply thread
  useEffect(() => {
    const messageId = searchParams.get('messageId');
    const fileId = searchParams.get('fileId');
    const replyId = searchParams.get('replyId');

    console.log('Highlight check:', {
      messageId,
      currentMessageId: id,
      fileId,
      files,
      matches: {
        messageMatch: messageId === id,
        fileMatch: fileId && files?.some?.((file) => file.id === fileId),
      },
    });

    const shouldHighlight =
      messageId === id || (fileId && files?.some?.((file) => file.id === fileId));

    if (shouldHighlight) {
      setIsHighlighted(true);
      // Scroll the message into view with a smooth animation
      messageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      // Remove highlight after animation
      const timeout = setTimeout(() => setIsHighlighted(false), 20000);
      return () => clearTimeout(timeout);
    }
  }, [id, files, searchParams]);

  // Load reply count
  useEffect(() => {
    const loadReplyCount = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', id);

      if (error) {
        console.error('Error loading reply count:', error);
        return;
      }

      setReplyCount(count || 0);
    };

    loadReplyCount();
  }, [id, supabase]);

  const handleEdit = async () => {
    if (!editedContent.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: editedContent.trim() })
        .eq('id', id)
        .eq('user_id', currentUser);

      if (error) throw error;

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message. Please try again.');
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser);

      if (error) throw error;

      onDelete?.(id);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message. Please try again.');
    }
  };

  return (
    <div
      ref={messageRef}
      className={cn(
        'flex gap-3 p-4 hover:bg-muted/50 transition-colors group relative',
        isHighlighted && 'animate-highlight',
        className
      )}
    >
      <Link href={`/users/${userId}`} className="hover:opacity-80 transition-opacity">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/users/${userId}`} className="hover:underline">
            <span className="font-medium">{username}</span>
          </Link>
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
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete message">
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
                  setIsEditing(false);
                  setEditedContent(content);
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {files && files.length > 0 && (
              <div className="mt-2 space-y-2">
                {files.map((file) => {
                  const FileIcon = getFileIcon(file.type);
                  const isImage = file.type.startsWith('image/');

                  return (
                    <div
                      key={file.name}
                      className="flex items-start gap-2 p-2 rounded-md bg-muted/50 max-w-md"
                    >
                      {isImage ? (
                        <div className="relative w-48 h-48">
                          <Image
                            src={file.url}
                            alt={file.name}
                            fill
                            className="object-cover rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <a href={file.url} download={file.name} className="shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Download file"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <MessageReactions messageId={id} channelId={channelId} className="mt-2" />
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity',
                  'hover:bg-muted/80 dark:hover:bg-muted/50'
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
  );
}
