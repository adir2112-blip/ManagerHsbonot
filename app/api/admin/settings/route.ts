import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase.from('app_settings').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { reminder_day_of_month, reminder_interval_days } = body || {}
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: ctx.user.id }
  if (reminder_day_of_month !== undefined) patch.reminder_day_of_month = reminder_day_of_month
  if (reminder_interval_days !== undefined) patch.reminder_interval_days = reminder_interval_days

  const { data, error } = await ctx.supabase.from('app_settings').update(patch).eq('id', true).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
