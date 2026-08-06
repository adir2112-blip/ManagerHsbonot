import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

// No DELETE — form_types are soft-deleted only (active=false), matching the DB's RLS
// (no delete policy exists) so history never loses a type it once referenced.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const allowed = ['name', 'sort_order', 'active']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) if (key in body) patch[key] = body[key]
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 })
  patch.updated_at = new Date().toISOString()

  const { data, error } = await ctx.supabase.from('form_types').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ formType: data })
}
