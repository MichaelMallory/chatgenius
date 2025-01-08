import { NextResponse } from 'next/server'

// Temporarily disabled authentication middleware
export async function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
} 