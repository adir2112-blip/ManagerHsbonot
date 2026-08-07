import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { isMonthRelevant, applicableFormTypes, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

// Powers the "sweep by form type" view — the inverse of the normal per-client checklist: pick
// ONE form type and see every client's status for it this month, so a bookkeeper doing a batch
// pass (e.g. "who's still missing VAT paperwork") doesn't have to open each client separately.
// No formTypeId -> just the catalog, for the picker dropdown.
export async function GET(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const url = new URL(req.url)
  const formTypeId = url.searchParams.get('formTypeId')

  const { data: allFormTypes } = await ctx.supabase.from('form_types').select('*').eq('active', true).order('sort_order')

  if (!formTypeId) {
    return NextResponse.json({ formTypes: allFormTypes || [] })
  }

  const formType = (allFormTypes || []).find(ft => ft.id === formTypeId)
  if (!formType) return NextResponse.json({ error: 'סוג טופס לא נמצא' }, { status: 404 })

  const today = israelToday()
  const { data: clients } = await ctx.supabase
    .from('clients')
    .select('*, assigned_employee:assigned_employee_id(id, full_name)')
    .eq('active', true)
  const clientIds = (clients || []).map(c => c.id)

  const [{ data: items }, formTypeMap] = await Promise.all([
    ctx.supabase.from('checklist_items').select('*').eq('form_type_id', formTypeId).eq('year', today.year).eq('month', today.month),
    fetchClientFormTypeMap(ctx.supabase, clientIds),
  ])
  const itemByClient = new Map((items || []).map(i => [i.client_id, i]))

  const rows = (clients || [])
    .filter(c => isMonthRelevant(c.cycle, c.cycle_start_date, today.year, today.month))
    .filter(c => (formTypeMap.get(c.id) || new Set()).has(formTypeId))
    .filter(c => applicableFormTypes([formType], today.year, today.month).length > 0)
    .map(c => ({
      client_id: c.id,
      client_name: c.name,
      assigned_employee: c.assigned_employee?.full_name || null,
      checked: !!itemByClient.get(c.id)?.checked,
    }))
    .sort((a, b) => Number(a.checked) - Number(b.checked)) // unchecked first — that's the work list

  return NextResponse.json({ formType, today, clients: rows })
}
