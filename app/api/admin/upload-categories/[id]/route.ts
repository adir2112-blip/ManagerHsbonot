import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof body?.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body?.icon === 'string' && body.icon.trim()) patch.icon = body.icon.trim().slice(0, 8)
  if (typeof body?.active === 'boolean') patch.active = body.active
  if (body?.kind === 'upload' || body?.kind === 'pickup') patch.kind = body.kind
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 })
  const { data, error } = await guard.ctx.supabase.from('upload_categories').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ category: data })
}
