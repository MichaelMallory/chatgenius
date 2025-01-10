'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ChannelProvider } from '../channel/channel-provider'
import { DirectMessageList } from '../chat/direct-message-list'

export function Sidebar() {
  const router = useRouter()
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true)
  const [isDMsExpanded, setIsDMsExpanded] = useState(true)

  return (
    <div className="flex h-full w-60 flex-col bg-slate-900 text-slate-50">
      {/* Workspace Header */}
      <div className="flex h-12 items-center border-b border-slate-800 px-4">
        <Button 
          variant="ghost" 
          className="w-full justify-between text-slate-50 hover:bg-slate-800"
          onClick={() => router.push('/channels/general')}
        >
          <span className="font-semibold">ChatGenius</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {/* Channels Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-sm font-semibold text-slate-400 hover:text-slate-50"
                onClick={() => setIsChannelsExpanded(!isChannelsExpanded)}
              >
                {isChannelsExpanded ? (
                  <ChevronDown className="mr-1 h-3 w-3" />
                ) : (
                  <ChevronRight className="mr-1 h-3 w-3" />
                )}
                Channels
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-slate-400 hover:bg-slate-800 hover:text-slate-50"
                onClick={() => {
                  const dialog = document.getElementById('create-channel-trigger')
                  if (dialog) {
                    dialog.click()
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {isChannelsExpanded && <ChannelProvider />}
          </div>

          <Separator className="bg-slate-800" />

          {/* Direct Messages Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-sm font-semibold text-slate-400 hover:text-slate-50"
                onClick={() => setIsDMsExpanded(!isDMsExpanded)}
              >
                {isDMsExpanded ? (
                  <ChevronDown className="mr-1 h-3 w-3" />
                ) : (
                  <ChevronRight className="mr-1 h-3 w-3" />
                )}
                Direct Messages
              </Button>
            </div>
            {isDMsExpanded && <DirectMessageList />}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
} 