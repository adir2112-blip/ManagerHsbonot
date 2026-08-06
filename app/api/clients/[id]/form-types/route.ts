import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'

// Returns the full ACTIVE catalog with a `selected` flag per type, so the client card can
// render one toggle list (only active catalog entries are selectable — a disabled type
// shouldn't be addable to a client even though old checklist_items may still reference it).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const [{ data: formTypes }, { data: selected }] = await Promise.all([
    ctx.supabase.from('form_types').select('*').eq('active', true).order('sort_order'),
    ctx.supabase.from('client_form_types').select('form_type_id').eq('client_id', params.id),
  ])
  const selectedIds = new Set((selected || []).map(s => s.form_type_id))

  return NextResponse.json({
    formTypes: (formTypes || []).map(ft => ({ ...ft, selected: selectedIds.has(ft.id) })),
  })
}

// Toggles a single form type on/off for this client — add is an insert, remove is a real
// delete (this table is just a selection, not history, so nothing needs preserving).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { form_type_id, selected } = body || {}
  if (!form_type_id || typeof selected !== 'boolean') {
    return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })
  }

  if (selected) {
    const { error } = await ctx.supabase.from('client_form_types').upsert({ client_id: params.id, form_type_id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await ctx.supabase.from('client_form_types').delete().eq('client_id', params.id).eq('form_type_id', form_type_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
