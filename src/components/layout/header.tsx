'use client'

import { Button } from '@/components/ui/button'
import { useSupabase } from '@/components/providers/supabase-provider'
import Link from 'next/link'
import { LogIn, LogOut, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface Profile {
  username: string;
}

export function Header() {
  const { supabase } = useSupabase()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        if (!error) {
          setProfile(profileData)
        }
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .single()

        if (!error) {
          setProfile(profileData)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

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
              >
                <Link href="/profile">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
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
                  <LogIn className="h-4 w-4" />
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