import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'

// Route handlers aren't covered by middleware.ts's /admin/* page guard (that only matches
// page paths, not /api/admin/*), so every admin API route calls this explicitly.
export async function requireAdmin() {
  const ctx = await getCurrentUser()
  if (!ctx) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) } as const
  if (ctx.role !== 'admin') return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) } as const
  return { ctx } as const
}

export async function requireAuth() {
  const ctx = await getCurrentUser()
  if (!ctx) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) } as const
  return { ctx } as const
}
