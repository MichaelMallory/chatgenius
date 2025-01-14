import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './middleware/rate-limit';

export function middleware(request: NextRequest) {
  // Only apply rate limiting to AI endpoints
  if (request.nextUrl.pathname.startsWith('/api/ai/')) {
    return rateLimit(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/ai/:path*',
};
