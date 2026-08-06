import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'

export async function GET() {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase
    .from('clients')
    .select('*, assigned_employee:assigned_employee_id(id, full_name)')
    .eq('active', true)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data })
}

export async function POST(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { name, cycle, cycle_start_date, assigned_employee_id, notes } = body || {}

  if (!name?.trim()) return NextResponse.json({ error: 'חסר שם לקוח' }, { status: 400 })
  if (cycle !== 'monthly' && cycle !== 'bimonthly') return NextResponse.json({ error: 'מחזוריות לא תקינה' }, { status: 400 })
  if (!cycle_start_date) return NextResponse.json({ error: 'חסר תאריך התחלה' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('clients')
    .insert({
      name: name.trim(),
      cycle,
      cycle_start_date,
      assigned_employee_id: assigned_employee_id || null,
      notes: notes || null,
      created_by: ctx.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
