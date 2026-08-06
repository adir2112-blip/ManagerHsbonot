import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { computeMonthStatus, israelToday, listRelevantMonths, type YearMonth } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const { data: client, error: clientErr } = await ctx.supabase
    .from('clients')
    .select('*, assigned_employee:assigned_employee_id(id, full_name)')
    .eq('id', params.id)
    .single()
  if (clientErr || !client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })

  const [{ data: allFormTypes }, { data: items }, formTypeMap] = await Promise.all([
    ctx.supabase.from('form_types').select('*'),
    ctx.supabase.from('checklist_items').select('*').eq('client_id', params.id),
    fetchClientFormTypeMap(ctx.supabase, [params.id]),
  ])
  const selectedIds = formTypeMap.get(params.id) || new Set()
  const formTypes = (allFormTypes || []).filter(ft => selectedIds.has(ft.id))

  const today = israelToday()
  const computedMonths = listRelevantMonths(client.cycle, client.cycle_start_date, today.year, today.month)

  // Union with any month that already has data — re-anchoring cycle_start_date later must
  // never make existing checklist_items rows disappear from the history view.
  const existingMonths = new Set((items || []).map(i => `${i.year}-${i.month}`))
  const monthKeys = new Set(computedMonths.map(m => `${m.year}-${m.month}`))
  const extraMonths: YearMonth[] = []
  for (const i of items || []) {
    const key = `${i.year}-${i.month}`
    if (!monthKeys.has(key)) { monthKeys.add(key); extraMonths.push({ year: i.year, month: i.month }) }
  }
  const allMonths = [...computedMonths, ...extraMonths].sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month))

  const history = allMonths.map(m => ({
    ...m,
    ...computeMonthStatus(formTypes || [], items || [], m.year, m.month),
  })).reverse() // newest month first

  return NextResponse.json({ client, formTypes: formTypes || [], history, today })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const allowed = ['name', 'phone', 'email', 'cycle', 'cycle_start_date', 'assigned_employee_id', 'notes', 'active']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) if (key in body) patch[key] = body[key]
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 })
  patch.updated_at = new Date().toISOString()

  const { data, error } = await ctx.supabase.from('clients').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}

// Permanent delete (explicit user request) — checklist_items, client_form_types, and
// reminder_events all cascade-delete with the client, wiping its full report history.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const { error } = await ctx.supabase.from('clients').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
