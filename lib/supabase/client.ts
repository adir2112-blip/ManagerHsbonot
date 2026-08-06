'use client'
// Browser client — used ONLY for the Auth handshake (signInWithPassword / signOut).
// Business data never goes through this client; every table read/write goes through
// a Next.js Route Handler using the server-side session client (lib/supabase/server.ts),
// so RLS is enforced against a real, validated auth.uid() and the frontend never
// talks to the database directly.
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
