import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory store for development
const store = new Map<string, { count: number; timestamp: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20; // requests per window

export function rateLimit(req: NextRequest) {
  // Get IP for rate limiting key
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Clean up old entries
  for (const [key, value] of store.entries()) {
    if (value.timestamp < windowStart) {
      store.delete(key);
    }
  }

  // Get or create rate limit entry
  const entry = store.get(ip) ?? { count: 0, timestamp: now };

  // Reset if outside window
  if (entry.timestamp < windowStart) {
    entry.count = 0;
    entry.timestamp = now;
  }

  // Increment count
  entry.count++;
  store.set(ip, entry);

  // Add rate limit headers
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', MAX_REQUESTS.toString());
  headers.set('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count).toString());
  headers.set('X-RateLimit-Reset', (entry.timestamp + RATE_LIMIT_WINDOW).toString());

  // Return 429 if exceeded
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      { status: 429, headers }
    );
  }

  return NextResponse.next({
    headers,
  });
}
