import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase.from('reminder_stages').select('*').order('days_overdue')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stages: data })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const days_overdue = Number(body?.days_overdue)
  if (!days_overdue || days_overdue < 1) return NextResponse.json({ error: 'מספר ימים לא תקין' }, { status: 400 })

  const { data, error } = await ctx.supabase.from('reminder_stages').insert({ days_overdue }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stage: data })
}
