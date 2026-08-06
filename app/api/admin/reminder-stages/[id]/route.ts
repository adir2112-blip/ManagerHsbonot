import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const days_overdue = Number(body?.days_overdue)
  if (!days_overdue || days_overdue < 1) return NextResponse.json({ error: 'מספר ימים לא תקין' }, { status: 400 })

  const { data, error } = await ctx.supabase.from('reminder_stages').update({ days_overdue }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stage: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const { error } = await ctx.supabase.from('reminder_stages').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
