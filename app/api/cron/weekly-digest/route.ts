import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email'
import { computeClientStatus, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

// Runs weekly (vercel.json) — a proactive nudge to each bookkeeper about HER OWN overdue
// clients for the current month, instead of relying on her to open the dashboard. Goes to
// profiles.notification_email (a real inbox), never the synthetic login email. Silently skips
// an employee with no notification_email set or nothing overdue — this is meant to be a signal
// worth opening, not a standing weekly noise.
async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = israelToday()

  const [{ data: profiles }, { data: clients }, { data: formTypes }, { data: items }, { data: settings }] = await Promise.all([
    admin.from('profiles').select('*').eq('active', true),
    admin.from('clients').select('*').eq('active', true),
    admin.from('form_types').select('*'),
    admin.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    admin.from('app_settings').select('*').single(),
  ])
  const reminderDay = settings?.reminder_day_of_month ?? 10
  const clientIds = (clients || []).map(c => c.id)
  const formTypeMap = await fetchClientFormTypeMap(admin, clientIds)

  let emailed = 0, skipped = 0

  for (const profile of profiles || []) {
    if (!profile.notification_email) { skipped++; continue }

    const myClients = (clients || []).filter(c => c.assigned_employee_id === profile.id)
    const overdue = myClients
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

    if (overdue.length === 0) { skipped++; continue }

    const severe = overdue.filter(r => r.daysBehind >= 7).length
    const list = overdue.map(r => `• ${r.client.name} (${r.daysBehind} ימים בפיגור)`).join('\n')
    const body = `שלום ${profile.full_name},\n\nיש לך ${overdue.length} לקוחות בפיגור החודש${severe > 0 ? `, מתוכם ${severe} בפיגור משמעותי (7+ ימים)` : ''}:\n\n${list}\n\nבהצלחה השבוע!`

    const result = await sendReminderEmail({
      to: profile.notification_email,
      subject: `תזכורת שבועית: ${overdue.length} לקוחות בפיגור`,
      body,
    })
    if (result.status === 'sent') emailed++
    else skipped++
  }

  return NextResponse.json({ ok: true, emailed, skipped })
}

export const GET = handle
export const POST = handle
