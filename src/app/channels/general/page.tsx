'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCcw } from 'lucide-react'

const GENERAL_CHANNEL_ID = '00000000-0000-0000-0000-000000000000'

export default function GeneralChannelPage() {
  const [channelId, setChannelId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { user } = useSupabase()

  const fetchGeneralChannel = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!user) {
        console.log('No user found, waiting for auth...')
        return
      }

      console.log('Fetching general channel for user:', user.id)

      // First, ensure we can access the general channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', GENERAL_CHANNEL_ID)
        .single()

      if (channelError) {
        console.error('Error fetching general channel:', channelError)
        throw new Error('Unable to access the general channel')
      }

      console.log('Found general channel:', channel)

      // Now check/create user membership
      const { data: membership, error: membershipError } = await supabase
        .from('user_channels')
        .select('*')
        .eq('channel_id', GENERAL_CHANNEL_ID)
        .eq('user_id', user.id)
        .single()

      if (membershipError) {
        console.log('User not in channel, attempting to join...')
        // User is not a member, try to join
        const { error: joinError } = await supabase
          .from('user_channels')
          .insert({
            channel_id: GENERAL_CHANNEL_ID,
            user_id: user.id,
            role: 'member'
          })

        if (joinError) {
          console.error('Error joining channel:', joinError)
          throw new Error('Failed to join the general channel')
        }

        console.log('Successfully joined channel')
      }

      setChannelId(channel.id)
    } catch (err) {
      console.error('Error in fetchGeneralChannel:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGeneralChannel()
  }, [user])

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <Card className="min-h-[calc(100vh-8rem)]">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <p>{error}</p>
            <Button
              onClick={() => fetchGeneralChannel()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!channelId || isLoading) {
    return (
      <div className="container mx-auto p-8">
        <Card className="min-h-[calc(100vh-8rem)]">
          <CardContent className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="mt-4">Loading channel...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <Card className="min-h-[calc(100vh-8rem)]">
        <CardHeader>
          <CardTitle>General Channel</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex-1 overflow-y-auto">
            <MessageList channelId={channelId} />
          </div>
          <MessageInput channelId={channelId} className="pt-4" />
        </CardContent>
      </Card>
    </div>
  )
} 