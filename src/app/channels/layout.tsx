'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Separator } from '@/components/ui/separator'

interface LayoutProps {
  children: React.ReactNode
}

export default function ChannelsLayout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <Separator orientation="vertical" className="h-screen" />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
} 