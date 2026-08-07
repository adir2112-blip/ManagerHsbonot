import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/server'
import { computeClientStatus, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'
import TodayReminders from '@/components/TodayReminders'

export const dynamic = 'force-dynamic'

// A focused landing view for a single bookkeeper: just what's actionable for HER right now —
// her own overdue clients this month, and her own reminders that have come due — instead of
// the full office dashboard she'd otherwise have to open and filter every time.
export default async function TodayPage() {
  const ctx = await getCurrentUser()
  if (!ctx) return null
  const { supabase, user } = ctx

  const today = israelToday()
  const { data: clients } = await supabase
    .from('clients')
    .select('*, assigned_employee:assigned_employee_id(id, full_name)')
    .eq('active', true)
    .eq('assigned_employee_id', user.id)
  const clientIds = (clients || []).map(c => c.id)

  const [{ data: formTypes }, { data: items }, { data: settings }, formTypeMap, { data: reminders }] = await Promise.all([
    supabase.from('form_types').select('*'),
    supabase.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    supabase.from('app_settings').select('*').single(),
    fetchClientFormTypeMap(supabase, clientIds),
    supabase
      .from('personal_reminders')
      .select('*, client:client_id(id, name), form_type:form_type_id(id, name)')
      .eq('created_by', user.id)
      .eq('is_done', false)
      .lte('remind_at', new Date().toISOString())
      .order('remind_at'),
  ])

  const reminderDay = settings?.reminder_day_of_month ?? 10
  const overdue = (clients || [])
    .map(c => {
      const selectedIds = formTypeMap.get(c.id) || new Set()
      const status = computeClientStatus({
        cycle: c.cycle, cycleStartDate: c.cycle_start_date,
        formTypes: (formTypes || []).filter(ft => selectedIds.has(ft.id)),
        items: (items || []).filter(i => i.client_id === c.id),
        today, reminderDayOfMonth: reminderDay,
      })
      return { client: c, ...status }
    })
    .filter(r => r.isBehind)
    .sort((a, b) => b.daysBehind - a.daysBehind)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">היום שלי</div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">לקוחות בפיגור אצלי</div></div>
        <div className="card-pad">
          {overdue.length === 0 && <div className="td-muted">🎉 אין לקוחות בפיגור אצלך כרגע</div>}
          {overdue.map(r => (
            <div key={r.client.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <Link href={`/clients/${r.client.id}`}>{r.client.name}</Link>
              <span>
                <span className="badge b-red">{r.daysBehind} ימים בפיגור</span>
                <span style={{ color: 'var(--text3)', fontSize: 11, marginRight: 8 }}>{r.checkedCount}/{r.total}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <TodayReminders reminders={reminders || []} />
    </div>
  )
}
