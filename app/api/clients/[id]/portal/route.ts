import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireAuth } from '@/lib/api-guard'

// Client-card portal settings: ID number (login = its last 4 digits), personal link, and which
// upload categories apply to this client.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const [{ data: client }, { data: categories }, { data: selected }] = await Promise.all([
    ctx.supabase.from('clients').select('id, name, phone, id_number, portal_token, portal_enabled').eq('id', params.id).single(),
    ctx.supabase.from('upload_categories').select('*').eq('active', true).order('sort_order'),
    ctx.supabase.from('client_upload_categories').select('category_id').eq('client_id', params.id),
  ])
  if (!client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
  const ids = new Set((selected || []).map(s => s.category_id))
  return NextResponse.json({
    client,
    categories: (categories || []).map(c => ({ ...c, selected: ids.has(c.id) })),
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const body = await req.json().catch(() => ({}))

  if (body?.category_id && typeof body.selected === 'boolean') {
    const q = body.selected
      ? ctx.supabase.from('client_upload_categories').upsert({ client_id: params.id, category_id: body.category_id })
      : ctx.supabase.from('client_upload_categories').delete().eq('client_id', params.id).eq('category_id', body.category_id)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const patch: Record<string, unknown> = {}
  if ('id_number' in body) {
    const digits = String(body.id_number || '').replace(/\D/g, '')
    if (digits && digits.length < 4) return NextResponse.json({ error: 'מספר זהות חייב לכלול לפחות 4 ספרות' }, { status: 400 })
    patch.id_number = digits || null
  }
  if (typeof body?.portal_enabled === 'boolean') patch.portal_enabled = body.portal_enabled
  if (body?.regenerate === true) patch.portal_token = randomBytes(32).toString('hex')
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 })
  patch.updated_at = new Date().toISOString()

  const { data, error } = await ctx.supabase.from('clients').update(patch).eq('id', params.id)
    .select('id, name, phone, id_number, portal_token, portal_enabled').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
