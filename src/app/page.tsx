'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { supabase } = useSupabase()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/channels/general')
      } else {
        router.push('/sign-in')
      }
    }
    checkAuth()
  }, [router, supabase])

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-4">Redirecting...</p>
        </CardContent>
      </Card>
    </div>
  )
}
