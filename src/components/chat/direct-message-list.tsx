'use client'

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PresenceIndicator } from '@/components/ui/presence-indicator';

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface DirectMessageChannel {
  id: string;
  participants: string[];
}

export function DirectMessageList() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [channels, setChannels] = useState<DirectMessageChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const pathname = usePathname();
  const { supabase } = useSupabase();
  const router = useRouter();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Fetch all users except current user
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .neq('id', user.id)
        .order('username');

      if (usersError) throw usersError;

      // Fetch existing DM channels
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select('id, participants')
        .eq('is_direct_message', true)
        .contains('participants', [user.id]);

      if (channelsError) throw channelsError;

      setUsers(usersData);
      setChannels(channelsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const handleStartDM = async (targetUserId: string) => {
    try {
      setIsProcessing(targetUserId);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Check if DM channel already exists
      const existingChannel = channels.find(channel =>
        channel.participants.includes(user.id) &&
        channel.participants.includes(targetUserId)
      );

      if (existingChannel) {
        router.push(`/channels/${existingChannel.id}`);
        return;
      }

      // Create new DM channel
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: `dm-${user.id}-${targetUserId}`,
          is_direct_message: true,
          participants: [user.id, targetUserId],
          created_by: user.id
        })
        .select()
        .single();

      if (channelError) throw channelError;

      // Add both users to the channel
      const { error: membershipError } = await supabase
        .from('user_channels')
        .insert([
          { user_id: user.id, channel_id: channelData.id },
          { user_id: targetUserId, channel_id: channelData.id }
        ]);

      if (membershipError) throw membershipError;

      // Navigate to the new channel
      router.push(`/channels/${channelData.id}`);
    } catch (error) {
      console.error('Error starting DM:', error);
      toast.error('Failed to start direct message');
    } finally {
      setIsProcessing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {users.map((user) => (
        <Button
          key={user.id}
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start",
            pathname === `/channels/${channels.find(channel =>
              channel.participants.includes(user.id)
            )?.id}` && "bg-muted"
          )}
          onClick={() => handleStartDM(user.id)}
          disabled={isProcessing === user.id}
        >
          <div className="flex items-center space-x-2 w-full">
            <div className="relative">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-slate-700 text-slate-200">{user.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <PresenceIndicator userId={user.id} />
            </div>
            <span className="truncate">{user.username}</span>
            {isProcessing === user.id && (
              <Loader2 className="h-4 w-4 animate-spin ml-auto" />
            )}
          </div>
        </Button>
      ))}
    </div>
  );
} 