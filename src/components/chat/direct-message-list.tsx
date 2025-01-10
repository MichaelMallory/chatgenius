'use client'

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

  const findOrCreateDMChannel = async (otherUserId: string) => {
    try {
      setIsProcessing(otherUserId);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Verify the other user still exists
      const { data: otherUserData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', otherUserId)
        .single();

      if (userError || !otherUserData) {
        toast.error('User no longer exists');
        await fetchData(); // Refresh the user list
        return;
      }

      // Check if DM channel already exists with current participants
      const { data: existingChannel, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .eq('is_direct_message', true)
        .contains('participants', [user.id, otherUserId])
        .single();

      if (!channelError && existingChannel) {
        router.push(`/channels/${existingChannel.id}`);
        return;
      }

      // Create new DM channel
      const channelName = `dm-${user.id}-${otherUserId}`;
      const { data: newChannel, error: createError } = await supabase
        .from('channels')
        .insert({
          name: channelName,
          description: `Direct message between users`,
          is_direct_message: true,
          created_by: user.id,
          participants: [user.id, otherUserId]
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add both users to the channel
      const { error: membershipError } = await supabase
        .from('user_channels')
        .insert([
          { channel_id: newChannel.id, user_id: user.id, role: 'member' },
          { channel_id: newChannel.id, user_id: otherUserId, role: 'member' }
        ]);

      if (membershipError) throw membershipError;

      router.push(`/channels/${newChannel.id}`);
    } catch (error) {
      console.error('Error handling DM:', error);
      toast.error('Failed to open direct message');
    } finally {
      setIsProcessing(null);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to channel changes
    const channelsSubscription = supabase
      .channel('dm-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: 'is_direct_message=eq.true',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channelsSubscription.unsubscribe();
    };
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
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
            'w-full justify-start text-slate-50 hover:bg-slate-800',
            pathname === `/channels/${
              channels.find(c => 
                c.participants.includes(user.id)
              )?.id
            }` && 'bg-slate-800'
          )}
          onClick={() => findOrCreateDMChannel(user.id)}
          disabled={isProcessing === user.id}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          {user.username}
          {isProcessing === user.id && (
            <Loader2 className="ml-2 h-3 w-3 animate-spin" />
          )}
        </Button>
      ))}
    </div>
  );
} 