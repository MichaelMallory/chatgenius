'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'
import { PresenceIndicator } from '@/components/ui/presence-indicator'

export default function ProfilePage() {
  const { supabase } = useSupabase()
  const [profile, setProfile] = useState<{
    id: string
    username: string
    avatar_url: string | null
    status: string | null
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingStatus, setIsSavingStatus] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, status')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
        toast.error('Failed to load profile')
        return
      }

      setProfile(data)
    }

    loadProfile()
  }, [supabase])

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setIsUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get the old avatar URL if it exists
      const oldAvatarUrl = profile?.avatar_url
      let oldFileName: string | null = null
      if (oldAvatarUrl) {
        // Extract the file name from the URL
        const urlParts = oldAvatarUrl.split('/')
        oldFileName = urlParts[urlParts.length - 1]
      }

      // Upload new file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          // Add a timestamp to force a change event
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Delete old avatar file if it exists
      if (oldFileName) {
        const { error: deleteError } = await supabase.storage
          .from('avatars')
          .remove([oldFileName])

        if (deleteError) {
          console.error('Error deleting old avatar:', deleteError)
          // Don't throw here, as the update was successful
        }
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      toast.success('Profile picture updated')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Failed to update profile picture')
    } finally {
      setIsUploading(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Manage your profile information and avatar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <PresenceIndicator userId={profile.id} className="h-4 w-4 border-[3px]" />
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                id="avatar-upload"
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
              <Label
                htmlFor="avatar-upload"
                className="cursor-pointer"
              >
                <Button
                  variant="outline"
                  className="space-x-2"
                  disabled={isUploading}
                  asChild
                >
                  <span>
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Upload new picture</span>
                      </>
                    )}
                  </span>
                </Button>
              </Label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={profile.username}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <div className="flex space-x-2">
                <Input
                  id="status"
                  value={profile.status || ''}
                  onChange={async (e) => {
                    const newStatus = e.target.value
                    setProfile(prev => prev ? { ...prev, status: newStatus } : null)
                    
                    setIsSavingStatus(true)
                    try {
                      const { error } = await supabase
                        .from('profiles')
                        .update({ 
                          status: newStatus,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', profile.id)

                      if (error) throw error
                      toast.success('Status updated')
                    } catch (error) {
                      console.error('Error updating status:', error)
                      toast.error('Failed to update status')
                    } finally {
                      setIsSavingStatus(false)
                    }
                  }}
                  placeholder="What's on your mind?"
                />
                {isSavingStatus && (
                  <Loader2 className="h-4 w-4 animate-spin mt-2" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 