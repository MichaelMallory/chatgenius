'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const GENERAL_CHANNEL_ID = '00000000-0000-0000-0000-000000000000'

export default function GeneralChannelPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { supabase } = useSupabase()
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          router.push('/sign-in')
          return
        }

        // First check if user is already a member
        const { data: membership, error: membershipCheckError } = await supabase
          .from('user_channels')
          .select('*')
          .eq('channel_id', GENERAL_CHANNEL_ID)
          .eq('user_id', user.id)
          .single()

        if (!membership && !membershipCheckError) {
          // User is not a member, try to join
          const { error: joinError } = await supabase
            .from('user_channels')
            .insert({
              user_id: user.id,
              channel_id: GENERAL_CHANNEL_ID,
              role: 'member'
            })

          if (joinError) {
            console.error('Error joining channel:', joinError)
            throw new Error('Failed to join the general channel')
          }
        }

      } catch (err) {
        console.error('Error in checkAccess:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        toast.error('Failed to access the general channel')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [supabase, router])

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
              onClick={() => window.location.reload()}
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

  if (isLoading) {
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
            <MessageList channelId={GENERAL_CHANNEL_ID} />
          </div>
          <MessageInput channelId={GENERAL_CHANNEL_ID} className="pt-4" />
        </CardContent>
      </Card>
    </div>
  )
} 