'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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

// Separate client component for messages
function ChannelMessages({ channelId }: { channelId: string }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <MessageList channelId={channelId} />
    </div>
  );
}

// Main channel content component
export function ChannelContent({ channelId }: { channelId: string }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { supabase, user } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const loadChannel = async () => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        // First load the channel details to check its type
        const { data: channelData, error: channelError } = await supabase
          .from('channels')
          .select('*')
          .eq('id', channelId)
          .single();

        if (channelError) {
          console.error('Error loading channel:', channelError);
          setError('Channel not found');
          return;
        }

        if (!channelData) {
          setError('Channel not found');
          return;
        }

        // Handle different channel types
        if (channelData.is_direct_message) {
          // For DMs, verify the user is a participant
          if (!channelData.participants?.includes(user.id)) {
            setError('You do not have access to this conversation');
            return;
          }

          // Load the other user's profile
          const otherUserId = channelData.participants.find((id: string) => id !== user.id);
          if (otherUserId) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, username')
              .eq('id', otherUserId)
              .single();

            if (profileError) throw profileError;
            setOtherUser(profileData);
          }
        } else {
          // For all non-DM channels, ensure user membership
          const { error: membershipError } = await supabase.from('user_channels').upsert(
            {
              user_id: user.id,
              channel_id: channelId,
              role: 'member',
            },
            {
              onConflict: 'user_id,channel_id',
            }
          );

          if (membershipError) {
            // If there's an error, try one more time after a short delay
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const { error: retryError } = await supabase.from('user_channels').upsert(
              {
                user_id: user.id,
                channel_id: channelId,
                role: 'member',
              },
              {
                onConflict: 'user_id,channel_id',
              }
            );

            // Only log error if we can't verify membership exists
            if (retryError) {
              const { data: membershipCheck } = await supabase
                .from('user_channels')
                .select('user_id')
                .eq('user_id', user.id)
                .eq('channel_id', channelId)
                .single();

              if (!membershipCheck) {
                console.error('Error ensuring channel membership after retry:', retryError);
                setError('Unable to access channel');
                return;
              }
            }
          }
        }

        // If we have a messageId in the URL, verify it exists
        const searchParams = new URLSearchParams(window.location.search);
        const messageId = searchParams.get('messageId');
        if (messageId) {
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select('id')
            .eq('id', messageId)
            .eq('channel_id', channelId)
            .single();

          if (messageError || !messageData) {
            console.error('Error loading message:', messageError);
            setError('The referenced message was not found');
            return;
          }
        }

        setChannel(channelData);
      } catch (error) {
        console.error('Error loading channel:', error);
        setError('Failed to load channel');
      } finally {
        setIsLoading(false);
      }
    };

    loadChannel();
  }, [supabase, router, channelId, user]);

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
            <Button onClick={() => window.location.reload()} disabled={isLoading}>
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
    );
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
    );
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
          <ChannelMessages channelId={channelId} />
          <MessageInput channelId={channelId} className="pt-4" />
        </CardContent>
      </Card>
    </div>
  );
}
