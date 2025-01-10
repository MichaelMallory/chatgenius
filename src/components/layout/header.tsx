'use client'

import { Button } from '@/components/ui/button'
import { useSupabase } from '@/components/providers/supabase-provider'
import Link from 'next/link'
import { LogIn, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PresenceIndicator } from '@/components/ui/presence-indicator'

interface Profile {
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export function Header() {
  const { supabase } = useSupabase()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Initial user fetch:', user?.id)
      setUser(user)

      if (user) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url')
          .eq('id', user.id)
          .single()

        if (!error) {
          console.log('Initial profile fetch:', profileData)
          setProfile(profileData)
        }
      }
    }
    getUser()

    // Subscribe to auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      console.log('Auth state changed:', currentUser?.id)
      setUser(currentUser)

      if (currentUser) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url')
          .eq('id', currentUser.id)
          .single()

        if (!error) {
          console.log('Profile fetch on auth change:', profileData)
          setProfile(profileData)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      console.log('Cleaning up auth subscription')
      authSubscription.unsubscribe()
    }
  }, [supabase])

  // Separate effect for profile changes subscription
  useEffect(() => {
    if (!user?.id) return

    console.log('Setting up profile subscription for user:', user.id)
    
    // Subscribe to profile changes
    const channel = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('Profile update received:', payload.new)
          // Fetch fresh profile data to ensure we have all fields
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', user.id)
            .single()

          if (!error && profileData) {
            console.log('Updated profile data:', profileData)
            setProfile(profileData)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up profile subscription')
      channel.unsubscribe()
    }
  }, [supabase, user?.id])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      // Clear any local storage data
      window.localStorage.removeItem('supabase.auth.token')
      window.localStorage.removeItem('supabase.auth.expires_at')
      window.localStorage.removeItem('supabase.auth.refresh_token')
      // Force clear all Supabase cache
      await supabase.auth.refreshSession()
      // Reset states
      setUser(null)
      setProfile(null)
      // Redirect to sign-in
      router.push('/sign-in')
      // Force reload to clear any remaining state
      window.location.reload()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header className="border-b">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold">
          ChatGenius
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {profile?.username || 'Loading...'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="space-x-2"
              >
                <Link href="/profile">
                  <div className="relative">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback>{profile?.username?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {user && <PresenceIndicator userId={user.id} />}
                  </div>
                  <span>Profile</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link href="/sign-in">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Link>
              </Button>
              <Button
                size="sm"
                asChild
              >
                <Link href="/sign-up">
                  Sign Up
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
} 