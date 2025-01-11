'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { PresenceIndicator } from '@/components/ui/presence-indicator'

export default function UserProfilePage() {
  const { userId } = useParams()
  const { supabase } = useSupabase()
  const [profile, setProfile] = useState<{
    id: string
    username: string
    avatar_url: string | null
    status: string | null
  } | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, status')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
        return
      }

      setProfile(data)
    }

    loadProfile()
  }, [supabase, userId])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>@{profile.username}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <PresenceIndicator userId={profile.id} className="h-4 w-4 border-[3px]" />
            </div>
          </div>

          {profile.status && (
            <div className="text-center text-muted-foreground">
              {profile.status}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 