import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { currentPeriod } from '@/lib/portal-data'
import { parsePeriodKey, periodKey, periodLabel, recentPeriods, samePeriod } from '@/lib/portal'

export const dynamic = 'force-dynamic'

// Office uploads dashboard: every active client × their selected categories, with what was
// submitted for the chosen bimonthly period. Defaults to the current period ("resets" every
// two months); older periods are picked from the selector.
export async function GET(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const cur = currentPeriod()
  const period = parsePeriodKey(new URL(req.url).searchParams.get('period')) || cur

  const [{ data: clients, error }, { data: categories }, { data: links }, { data: subs }] = await Promise.all([
    ctx.supabase.from('clients')
      .select('id, name, phone, id_number, portal_token, portal_enabled, assigned_employee:assigned_employee_id(id, full_name)')
      .eq('active', true).order('name'),
    ctx.supabase.from('upload_categories').select('*').eq('active', true).order('sort_order'),
    ctx.supabase.from('client_upload_categories').select('client_id, category_id'),
    ctx.supabase.from('portal_submissions')
      .select('id, client_id, category_id, kind, file_name, file_size, original_size, mime_type, note, created_at')
      .eq('period_year', period.year).eq('period_start_month', period.startMonth)
      .order('created_at', { ascending: false }),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const selected = new Map<string, string[]>()
  for (const l of links || []) {
    if (!selected.has(l.client_id)) selected.set(l.client_id, [])
    selected.get(l.client_id)!.push(l.category_id)
  }

  const rows = (clients || []).map(c => {
    const { portal_token, id_number, ...rest } = c as any
    return {
      ...rest,
      portal_token,
      has_id_number: (id_number || '').replace(/\D/g, '').length >= 4,
      categoryIds: selected.get(c.id) || [],
      submissions: (subs || []).filter(s => s.client_id === c.id),
    }
  })

  return NextResponse.json({
    period: { key: periodKey(period), label: periodLabel(period), isCurrent: samePeriod(period, cur) },
    periods: recentPeriods(cur, 12).map(p => ({ key: periodKey(p), label: periodLabel(p) })),
    categories: categories || [],
    rows,
  })
}
