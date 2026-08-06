import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const allowed = ['is_done', 'remind_at', 'note']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) if (key in body) patch[key] = body[key]
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 })

  const { data, error } = await ctx.supabase.from('personal_reminders').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reminder: data })
}
