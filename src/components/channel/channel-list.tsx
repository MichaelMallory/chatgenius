import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
  is_direct_message: boolean;
}

interface ChannelListProps {
  channels: Channel[];
  isLoading?: boolean;
}

export function ChannelList({ channels, isLoading = false }: ChannelListProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleChannelClick = (channelId: string) => {
    router.push(`/channels/${channelId}`);
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-1">
      {channels.map((channel) => (
        <Button
          key={channel.id}
          variant="ghost"
          size="sm"
          className={cn(
            'w-full justify-start text-slate-50 hover:bg-slate-800',
            pathname === `/channels/${channel.id}` && 'bg-slate-800'
          )}
          onClick={() => handleChannelClick(channel.id)}
        >
          <Hash className="mr-2 h-4 w-4" />
          {channel.name}
        </Button>
      ))}
    </div>
  );
} 