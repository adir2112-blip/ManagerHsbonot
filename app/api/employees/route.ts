import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'

// Minimal roster for assignee dropdowns — any authenticated user can see names (profiles_select
// RLS policy allows it), only admin/users exposes the full record (username/role/reset-password).
export async function GET() {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, full_name, active')
    .eq('active', true)
    .order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data })
}
