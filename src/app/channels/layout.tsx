'use client'

import { ChannelList } from '@/components/channel/channel-list'
import { Separator } from '@/components/ui/separator'

interface LayoutProps {
  children: React.ReactNode
}

export default function ChannelsLayout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r bg-muted/50">
        <ChannelList />
      </div>
      <Separator orientation="vertical" />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
} 