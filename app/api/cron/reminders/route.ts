import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email'
import { isMonthRelevant, applicableFormTypes, shouldSendReminder, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

// Runs daily via Vercel Cron (vercel.json), which invokes with GET and auto-attaches
// "Authorization: Bearer $CRON_SECRET". Also exported as POST for manual curl testing.
// Uses the service-role client (bypasses RLS) — this is a system context, not a user
// session, matching reminder_events' RLS (no write policy exists for regular users, only reads).
//
// Goes to the CLIENT directly (clients.email) — NOT the assigned employee. employee_id on
// reminder_events is kept only as a reference to who owns the client, not a recipient.
async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = israelToday()

  const [{ data: clients }, { data: formTypes }, { data: settings }] = await Promise.all([
    admin.from('clients').select('*, assigned_employee:assigned_employee_id(id, full_name)').eq('active', true),
    admin.from('form_types').select('*'),
    admin.from('app_settings').select('*').single(),
  ])

  const clientIds = (clients || []).map(c => c.id)
  const formTypeMap = await fetchClientFormTypeMap(admin, clientIds)

  const reminderDayOfMonth = settings?.reminder_day_of_month ?? 10
  const reminderIntervalDays = settings?.reminder_interval_days ?? 3

  let sent = 0, skipped = 0, failed = 0, notDue = 0

  for (const client of clients || []) {
    if (!isMonthRelevant(client.cycle, client.cycle_start_date, today.year, today.month)) continue
    if (!client.email) { skipped++; continue }

    const selectedIds = formTypeMap.get(client.id) || new Set()
    const clientFormTypes = (formTypes || []).filter(ft => selectedIds.has(ft.id))

    const { data: items } = await admin
      .from('checklist_items')
      .select('*')
      .eq('client_id', client.id)
      .eq('year', today.year)
      .eq('month', today.month)

    const applicable = applicableFormTypes(clientFormTypes, today.year, today.month)
    const checkedIds = new Set((items || []).filter(i => i.checked).map(i => i.form_type_id))
    const missing = applicable.filter(ft => !checkedIds.has(ft.id))
    if (missing.length === 0) continue // complete

    const { data: lastEvent } = await admin
      .from('reminder_events')
      .select('sent_at')
      .eq('client_id', client.id)
      .eq('year', today.year)
      .eq('month', today.month)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const due = shouldSendReminder({
      today,
      relevantYear: today.year,
      relevantMonth: today.month,
      reminderDayOfMonth,
      reminderIntervalDays,
      lastSentAt: lastEvent?.sent_at ? new Date(lastEvent.sent_at) : null,
    })
    if (!due) { notDue++; continue }

    const missingNames = missing.map((ft: any) => `• ${ft.name}`).join('\n')
    const result = await sendReminderEmail({
      to: client.email,
      subject: `תזכורת: טפסים חסרים החודש — ${client.name}`,
      body: `שלום ${client.name},\n\nטרם התקבלו אצלנו הטפסים הבאים החודש:\n${missingNames}\n\nנשמח לקבל אותם בהקדם.\nתודה!\n`,
    })

    await admin.from('reminder_events').insert({
      client_id: client.id,
      employee_id: client.assigned_employee?.id || null,
      year: today.year,
      month: today.month,
      status: result.status,
      error_message: result.error || null,
      sent_at: new Date().toISOString(),
    })

    if (result.status === 'sent') sent++
    else if (result.status === 'failed') failed++
    else skipped++
  }

  return NextResponse.json({ ok: true, sent, skipped, failed, notDue })
}

export const GET = handle
export const POST = handle
