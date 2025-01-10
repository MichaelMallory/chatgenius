'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useHotkeys } from 'react-hotkeys-hook'
import { Search, MessageSquare } from 'lucide-react'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface SearchResult {
  type: 'message' | 'file'
  id: string
  content: string
  channel_id: string
  channel_name: string
  user_id: string
  username: string
  created_at: string
  parent_id: string | null
  message_id?: string
  similarity: number
}

interface SearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchDialog({ open: controlledOpen, onOpenChange }: SearchDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const { supabase } = useSupabase()
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen

  // Handle Cmd/Ctrl + K to open search
  useHotkeys(['meta+k', 'ctrl+k'], (event: KeyboardEvent) => {
    event.preventDefault()
    if (!open) {
      setOpen(true)
    }
  }, {
    enableOnFormTags: true,
    preventDefault: true,
    enabled: !loading // Disable shortcut while loading
  })

  // Focus input when dialog opens and cleanup when it closes
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      // Cleanup when dialog closes
      setQuery('')
      setResults([])
      setLoading(false)
      if (inputRef.current) {
        inputRef.current.blur()
      }
    }
  }, [open])

  // Handle search
  React.useEffect(() => {
    const searchContent = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase.rpc('search_content', {
          search_query: query
            .trim()
            .split(/\s+/)
            .map(word => word + ':*')
            .join(' & ')
        })

        if (error) throw error
        setResults(data || [])
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(searchContent, 300)
    return () => clearTimeout(debounce)
  }, [query, supabase])

  const handleSelect = async (result: SearchResult) => {
    // Disable the dialog and clear state immediately
    setOpen(false)
    setQuery('')
    setResults([])
    setLoading(false)
    
    // Navigate after state is cleared
    const params = new URLSearchParams()
    if (result.type === 'file') {
      params.set('fileId', result.id)
      params.set('messageId', result.message_id!)
    } else {
      if (result.parent_id) {
        params.set('messageId', result.parent_id)
        params.set('replyId', result.id)
      } else {
        params.set('messageId', result.id)
      }
    }
    router.push(`/channels/${result.channel_id}?${params.toString()}`)
  }

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          // Immediate cleanup when closing
          setQuery('')
          setResults([])
          setLoading(false)
          if (inputRef.current) {
            inputRef.current.blur()
          }
        }
        setOpen(newOpen)
      }}
    >
      <DialogContent className="max-w-2xl p-0">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            className="h-12 border-0 focus-visible:ring-0"
            placeholder="Search messages and files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query.trim() && (
          <ScrollArea className="max-h-[60vh] min-h-[200px] py-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="text-sm text-muted-foreground">Searching...</div>
              </div>
            ) : results.length > 0 ? (
              <div className="px-2">
                {results.map((result) => (
                  <button
                    key={result.id}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
                    onClick={() => handleSelect(result)}
                  >
                    <Avatar className="mt-0.5 h-8 w-8">
                      <AvatarImage src={`/api/avatar/${result.user_id}`} />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {result.type === 'file' ? '📎 File:' : result.parent_id ? (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Reply in thread
                            </span>
                          ) : 'Message'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          by {result.username} in #{result.channel_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(result.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {result.content}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10">
                <div className="text-sm text-muted-foreground">No results found</div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
} 