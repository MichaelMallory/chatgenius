'use client'

import { Button } from '@/components/ui/button'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { LogIn, LogOut, User } from 'lucide-react'

export function Header() {
  const { user } = useSupabase()

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
                {user.email}
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
                onClick={() => supabase.auth.signOut()}
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