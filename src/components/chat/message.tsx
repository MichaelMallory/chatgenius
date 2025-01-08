import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageProps {
  content: string
  username: string
  avatarUrl?: string
  createdAt: Date
  isCurrentUser?: boolean
}

export function Message({ content, username, avatarUrl, createdAt, isCurrentUser }: MessageProps) {
  return (
    <div className={cn(
      "flex gap-3 p-4 hover:bg-muted/50 transition-colors",
      isCurrentUser && "flex-row-reverse"
    )}>
      <Avatar>
        <AvatarImage src={avatarUrl} />
        <AvatarFallback>{username[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className={cn(
        "flex flex-col gap-1",
        isCurrentUser && "items-end"
      )}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{username}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
        </div>
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
} 