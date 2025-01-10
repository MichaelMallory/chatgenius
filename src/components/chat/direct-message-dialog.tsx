'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function DirectMessageDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { supabase } = useSupabase()
  const router = useRouter()

  const handleStartDM = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username')
      return
    }

    setIsLoading(true)
    try {
      // Find the user by username
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username.trim())
        .single()

      if (userError || !targetUser) {
        toast.error('User not found')
        return
      }

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Authentication error')
        return
      }

      if (user.id === targetUser.id) {
        toast.error('You cannot start a direct message with yourself')
        return
      }

      // Check if DM channel already exists
      const { data: existingChannels, error: channelError } = await supabase
        .from('channels')
        .select('id')
        .eq('is_direct_message', true)
        .contains('participants', [user.id, targetUser.id])
        .single()

      if (channelError && channelError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error checking existing channels:', channelError)
        toast.error('Failed to check existing channels')
        return
      }

      if (existingChannels) {
        router.push(`/channels/${existingChannels.id}`)
        setIsOpen(false)
        return
      }

      // Create new DM channel with a descriptive name
      const channelName = `dm-${user.id}-${targetUser.id}`
      const { data: newChannel, error: createError } = await supabase
        .from('channels')
        .insert({
          name: channelName,
          description: `Direct message between users`,
          is_direct_message: true,
          created_by: user.id,
          participants: [user.id, targetUser.id]
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating channel:', createError)
        toast.error('Failed to create direct message')
        return
      }

      // Add both users to the channel
      const { error: membershipError } = await supabase
        .from('user_channels')
        .insert([
          { channel_id: newChannel.id, user_id: user.id, role: 'member' },
          { channel_id: newChannel.id, user_id: targetUser.id, role: 'member' }
        ])

      if (membershipError) {
        console.error('Error adding channel members:', membershipError)
        toast.error('Failed to set up direct message')
        return
      }

      toast.success(`Started chat with ${targetUser.username}`)
      router.push(`/channels/${newChannel.id}`)
      setIsOpen(false)
      setUsername('')
    } catch (error) {
      console.error('DM creation error:', error)
      toast.error('Failed to create direct message')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          id="direct-message-trigger"
          variant="ghost" 
          size="sm" 
          className="hidden"
        >
          Direct Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Direct Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartDM}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Chat'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 