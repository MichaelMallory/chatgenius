import React, { useEffect, useState } from 'react';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { toast } from 'sonner';
import { ChannelList } from './channel-list';
import { CreateChannelDialog } from './create-channel-dialog';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
  is_direct_message: boolean;
}

export function ChannelProvider() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { supabase } = useSupabase();

  const fetchChannels = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, ensure user is member of general channel
      const { error: membershipError } = await supabase
        .from('user_channels')
        .upsert({
          user_id: user.id,
          channel_id: '00000000-0000-0000-0000-000000000000',
          role: 'member'
        }, {
          onConflict: 'user_id,channel_id'
        });

      if (membershipError) {
        console.error('Error ensuring general channel membership:', membershipError);
      }

      // Fetch all accessible channels
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select('*')
        .eq('is_direct_message', false)
        .order('name');

      if (channelsError) {
        console.error('Error fetching channels:', channelsError);
        throw channelsError;
      }

      // Filter channels based on access rules
      const accessibleChannels = channelsData.filter(channel => 
        !channel.is_private || 
        channel.id === '00000000-0000-0000-0000-000000000000' ||
        channel.created_by === user.id
      );

      setChannels(accessibleChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelCreated = (newChannel: Channel) => {
    setChannels(prevChannels => {
      // Add the new channel to the list and sort by name
      const updatedChannels = [...prevChannels, newChannel];
      return updatedChannels.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  useEffect(() => {
    fetchChannels();

    // Subscribe to channel changes from other users
    const channelsSubscription = supabase
      .channel('channels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: 'is_direct_message=eq.false',
        },
        () => {
          fetchChannels();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_channels',
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      channelsSubscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div>
      <CreateChannelDialog onChannelCreated={handleChannelCreated} />
      <ChannelList channels={channels} isLoading={isLoading} />
    </div>
  );
} 