import { getCurrentUser } from '@/lib/supabase/server'
import { computeClientStatus, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'
import DashboardContent from '@/components/DashboardContent'

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const ctx = await getCurrentUser()
  if (!ctx) return null
  const { supabase } = ctx

  const today = israelToday()
  const { data: clients } = await supabase.from('clients').select('*, assigned_employee:assigned_employee_id(id, full_name)').eq('active', true)
  const clientIds = (clients || []).map(c => c.id)

  const [{ data: formTypes }, { data: items }, { data: settings }, formTypeMap] = await Promise.all([
    supabase.from('form_types').select('*'),
    supabase.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    supabase.from('app_settings').select('*').single(),
    fetchClientFormTypeMap(supabase, clientIds),
  ])

  const reminderDay = settings?.reminder_day_of_month ?? 10

  // Only clients whose cycle makes THIS month relevant show up at all — a bimonthly client
  // in its off month is simply absent, never shown as "not relevant".
  const rows = (clients || [])
    .map(c => {
      const selectedIds = formTypeMap.get(c.id) || new Set()
      const clientItems = (items || []).filter(i => i.client_id === c.id)
      const status = computeClientStatus({
        cycle: c.cycle, cycleStartDate: c.cycle_start_date,
        formTypes: (formTypes || []).filter(ft => selectedIds.has(ft.id)),
        items: clientItems,
        today, reminderDayOfMonth: reminderDay,
      })
      // "Completed at" = the moment the LAST outstanding item was checked — the checked_at of
      // the most recently checked item, which is when the client actually became complete.
      const completedAt = status.complete
        ? clientItems.filter(i => i.checked && i.checked_at).map(i => i.checked_at as string).sort().at(-1) ?? null
        : null
      return { client: c, ...status, completedAt }
    })
    .filter(r => r.relevant)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">לוח בקרה — {HEBREW_MONTHS[today.month - 1]} {today.year}</div>
      </div>

      <DashboardContent rows={rows} reminderDay={reminderDay} today={today} currentUserId={ctx.user.id} />
    </div>
  )
}
