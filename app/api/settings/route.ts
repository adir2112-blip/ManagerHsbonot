import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'

// Open to any authenticated user (not admin-only) — the overdue-day threshold is one shared
// office-wide setting, and any bookkeeper should be able to adjust it, not just the admin.
// RLS (app_settings_update policy) is the real enforcement of "authenticated, no ownership
// check needed" — this route-level check just rules out unauthenticated requests.
export async function GET() {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase.from('app_settings').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function PATCH(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const allowed = ['reminder_day_of_month', 'reminder_email_subject', 'reminder_email_body']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: ctx.user.id }
  for (const key of allowed) if (key in body) patch[key] = body[key]

  const { data, error } = await ctx.supabase.from('app_settings').update(patch).eq('id', true).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
