import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { CreateChannelDialog } from './create-channel-dialog';
import { Hash, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
}

export const ChannelList: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState<string>('00000000-0000-0000-0000-000000000000');
  const { supabase } = useSupabase();
  const router = useRouter();

  const fetchChannels = async () => {
    try {
      setIsLoading(true);
      const { data: channelsData, error } = await supabase
        .from('channels')
        .select('*')
        .order('name');

      if (error) throw error;
      setChannels(channelsData);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();

    // Subscribe to channel changes
    const channelsSubscription = supabase
      .channel('channels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
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

  const handleChannelClick = (channelId: string) => {
    setActiveChannelId(channelId);
    router.push(`/channels/${channelId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Channels</h2>
        <CreateChannelDialog onChannelCreated={fetchChannels} />
      </div>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-1">
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant={channel.id === activeChannelId ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                channel.id === activeChannelId && 'bg-muted'
              )}
              onClick={() => handleChannelClick(channel.id)}
            >
              <Hash className="h-4 w-4 mr-2" />
              <span className="truncate">{channel.name}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}; 