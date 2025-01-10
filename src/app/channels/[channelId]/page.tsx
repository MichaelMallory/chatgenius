'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { use } from 'react'

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
  is_direct_message: boolean;
  participants?: string[];
}

interface Profile {
  id: string;
  username: string;
}

interface PageProps {
  params: Promise<{
    channelId: string;
  }>;
}

export default function ChannelPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel | null>(null)
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
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

        // Check if channel exists and user has access
        const { data: channelData, error: channelError } = await supabase
          .from('channels')
          .select('*, participants')
          .eq('id', resolvedParams.channelId)
          .single()

        if (channelError) {
          console.error('Error fetching channel:', channelError)
          throw new Error('Unable to access this channel')
        }

        setChannel(channelData)

        // If it's a DM channel, fetch the other user's profile
        if (channelData.is_direct_message && channelData.participants) {
          const otherUserId = channelData.participants.find((id: string) => id !== user.id);
          if (otherUserId) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, username')
              .eq('id', otherUserId)
              .single();

            if (profileError) {
              console.error('Error fetching profile:', profileError);
            } else {
              setOtherUser(profileData);
            }
          }
        }

        // For private channels, check membership
        if (channelData.is_private) {
          const { data: membership, error: membershipError } = await supabase
            .from('user_channels')
            .select('*')
            .eq('channel_id', resolvedParams.channelId)
            .eq('user_id', user.id)
            .single()

          if (membershipError) {
            throw new Error('This is a private channel. You need an invitation to join.')
          }
        } else {
          // For public channels, ensure membership exists but don't block access
          const { data: membership, error: membershipError } = await supabase
            .from('user_channels')
            .select('*')
            .eq('channel_id', resolvedParams.channelId)
            .eq('user_id', user.id)
            .single()

          if (membershipError) {
            // Silently create membership for public channels
            await supabase
              .from('user_channels')
              .insert({
                channel_id: resolvedParams.channelId,
                user_id: user.id,
                role: 'member'
              })
              .single()
          }
        }
      } catch (err) {
        console.error('Error in checkAccess:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        toast.error('Failed to access the channel')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [supabase, router, resolvedParams.channelId])

  const getChannelTitle = () => {
    if (!channel) return '';
    if (channel.is_direct_message) {
      return otherUser ? `Chat with ${otherUser.username}` : 'Direct Message';
    }
    return channel.name;
  };

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

  if (isLoading || !channel) {
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
          <CardTitle>{getChannelTitle()}</CardTitle>
          {!channel.is_direct_message && channel.description && (
            <p className="text-sm text-muted-foreground">{channel.description}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex-1 overflow-y-auto">
            <MessageList channelId={resolvedParams.channelId} />
          </div>
          <MessageInput channelId={resolvedParams.channelId} className="pt-4" />
        </CardContent>
      </Card>
    </div>
  )
} 