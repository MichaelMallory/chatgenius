import React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { toast } from 'sonner';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
  is_direct_message: boolean;
}

interface CreateChannelDialogProps {
  onChannelCreated?: (channel: Channel) => void;
}

export const CreateChannelDialog: React.FC<CreateChannelDialogProps> = ({ onChannelCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { supabase } = useSupabase();
  const router = useRouter();

  const handleCreateChannel = async () => {
    if (!name.trim()) {
      toast.error('Channel name is required');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      // Create the channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: name.trim().toLowerCase().replace(/\s+/g, '-'),
          description: description.trim(),
          created_by: user.id,
          is_private: false,
          is_direct_message: false
        })
        .select()
        .single();

      if (channelError) {
        if (channelError.code === '23505') {
          toast.error('A channel with this name already exists');
        } else {
          throw channelError;
        }
        return;
      }

      // Add creator as a member with 'admin' role
      const { error: membershipError } = await supabase
        .from('user_channels')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          role: 'admin'
        });

      if (membershipError) throw membershipError;

      toast.success('Channel created successfully');
      setIsOpen(false);
      onChannelCreated?.(channel);
      setName('');
      setDescription('');
      
      // Navigate to the new channel
      router.push(`/channels/${channel.id}`);
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Failed to create channel');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          id="create-channel-trigger"
          variant="ghost" 
          size="sm" 
          className="hidden"
        >
          Create Channel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create a New Channel</AlertDialogTitle>
          <AlertDialogDescription>
            Channels are where conversations happen. They&apos;re best organized around a topic — #marketing, for example.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Channel Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. marketing"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              disabled={isLoading}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreateChannel} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Channel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}; 