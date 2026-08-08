import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { applicableFormTypes } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const url = new URL(req.url)
  const year = Number(url.searchParams.get('year'))
  const month = Number(url.searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'חסר year/month' }, { status: 400 })

  const [{ data: allFormTypes }, { data: items }, formTypeMap] = await Promise.all([
    ctx.supabase.from('form_types').select('*'),
    ctx.supabase.from('checklist_items').select('*, checked_by_profile:checked_by(full_name)').eq('client_id', params.id).eq('year', year).eq('month', month),
    fetchClientFormTypeMap(ctx.supabase, [params.id]),
  ])
  const selectedIds = formTypeMap.get(params.id) || new Set()
  const clientFormTypes = (allFormTypes || []).filter(ft => selectedIds.has(ft.id))

  const applicable = applicableFormTypes(clientFormTypes, year, month).sort((a: any, b: any) => a.sort_order - b.sort_order)
  return NextResponse.json({ formTypes: applicable, items: items || [] })
}

// Upserts one checklist row for (client, form_type, year, month). Un-checking is an UPDATE
// (checked=false), never a delete — history/notes are preserved. checked_by/checked_at only
// move when `checked` is actually part of the request (a note-only edit shouldn't touch them).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { form_type_id, year, month, checked, note, continue_treatment } = body || {}
  if (!form_type_id || !year || !month) return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })

  const { data: existing } = await ctx.supabase
    .from('checklist_items')
    .select('id')
    .eq('client_id', params.id)
    .eq('form_type_id', form_type_id)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (checked !== undefined) {
    patch.checked = checked
    patch.checked_by = ctx.user.id
    patch.checked_at = new Date().toISOString()
  }
  if (note !== undefined) patch.note = note
  if (continue_treatment !== undefined) patch.continue_treatment = continue_treatment

  if (existing) {
    const { data, error } = await ctx.supabase.from('checklist_items').update(patch).eq('id', existing.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  }

  const { data, error } = await ctx.supabase
    .from('checklist_items')
    .insert({ client_id: params.id, form_type_id, year, month, checked: !!checked, note: note ?? null, continue_treatment: !!continue_treatment, ...patch })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
