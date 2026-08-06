import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { computeClientStatus, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

// A name/phone search (?q=) is used by the topbar's global client search — kept on this same
// list endpoint rather than a separate route since it's the same underlying query shape.
// Each result carries its current-month status (behind/complete/in-progress + days behind) so
// the search dropdown can show it without a second round-trip per result.
export async function GET(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()

  let query = ctx.supabase
    .from('clients')
    .select('*, assigned_employee:assigned_employee_id(id, full_name)')
    .eq('active', true)
    .order('name')

  if (q) {
    // Strip characters that are syntactically meaningful inside a PostgREST .or() filter
    // string (comma separates conditions, parens group them) — a name/phone search never
    // needs them, and this avoids a user's search text accidentally reshaping the query.
    const safe = q.replace(/[,()%*]/g, ' ').trim()
    if (safe) query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }

  const { data: clients, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clients || clients.length === 0) return NextResponse.json({ clients: [] })

  const today = israelToday()
  const clientIds = clients.map(c => c.id)
  const [{ data: formTypes }, { data: items }, { data: settings }, formTypeMap] = await Promise.all([
    ctx.supabase.from('form_types').select('*'),
    ctx.supabase.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    ctx.supabase.from('app_settings').select('*').single(),
    fetchClientFormTypeMap(ctx.supabase, clientIds),
  ])
  const reminderDay = settings?.reminder_day_of_month ?? 10

  const enriched = clients.map(c => {
    const selectedIds = formTypeMap.get(c.id) || new Set()
    return {
      ...c,
      status: computeClientStatus({
        cycle: c.cycle, cycleStartDate: c.cycle_start_date,
        formTypes: (formTypes || []).filter(ft => selectedIds.has(ft.id)),
        items: (items || []).filter(i => i.client_id === c.id),
        today, reminderDayOfMonth: reminderDay,
      }),
    }
  })

  return NextResponse.json({ clients: enriched })
}

export async function POST(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { name, phone, email, cycle, cycle_start_date, assigned_employee_id, notes } = body || {}

  if (!name?.trim()) return NextResponse.json({ error: 'חסר שם לקוח' }, { status: 400 })
  if (cycle !== 'monthly' && cycle !== 'bimonthly') return NextResponse.json({ error: 'מחזוריות לא תקינה' }, { status: 400 })
  if (!cycle_start_date) return NextResponse.json({ error: 'חסר תאריך התחלה' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('clients')
    .insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      cycle,
      cycle_start_date,
      assigned_employee_id: assigned_employee_id || null,
      notes: notes || null,
      created_by: ctx.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // New clients start with the full active catalog selected (matches the old "one global
  // template for everyone" behavior) — the bookkeeper can then add/remove from the client card.
  const { data: activeTypes } = await ctx.supabase.from('form_types').select('id').eq('active', true)
  if (activeTypes && activeTypes.length > 0) {
    await ctx.supabase.from('client_form_types').insert(activeTypes.map(ft => ({ client_id: data.id, form_type_id: ft.id })))
  }

  return NextResponse.json({ client: data })
}
