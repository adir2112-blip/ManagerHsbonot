import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email'
import { isMonthRelevant, computeMonthStatus, shouldSendReminder, israelToday } from '@/lib/checklist'

// Runs daily via Vercel Cron (vercel.json), which invokes with GET and auto-attaches
// "Authorization: Bearer $CRON_SECRET". Also exported as POST for manual curl testing.
// Uses the service-role client (bypasses RLS) — this is a system context, not a user
// session, matching reminder_events' RLS (no write policy exists for regular users, only reads).
async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = israelToday()

  const [{ data: clients }, { data: formTypes }, { data: settings }] = await Promise.all([
    admin.from('clients').select('*, assigned_employee:assigned_employee_id(id, full_name, notification_email, active)').eq('active', true),
    admin.from('form_types').select('*'),
    admin.from('app_settings').select('*').single(),
  ])

  const reminderDayOfMonth = settings?.reminder_day_of_month ?? 10
  const reminderIntervalDays = settings?.reminder_interval_days ?? 3

  let sent = 0, skipped = 0, failed = 0, notDue = 0

  for (const client of clients || []) {
    if (!isMonthRelevant(client.cycle, client.cycle_start_date, today.year, today.month)) continue

    const employee = client.assigned_employee
    if (!employee || !employee.active || !employee.notification_email) { skipped++; continue }

    const { data: items } = await admin
      .from('checklist_items')
      .select('*')
      .eq('client_id', client.id)
      .eq('year', today.year)
      .eq('month', today.month)
    const status = computeMonthStatus(formTypes || [], items || [], today.year, today.month)
    if (status.complete) continue

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

    const result = await sendReminderEmail({
      to: employee.notification_email,
      subject: `תזכורת: טפסים לא הושלמו — ${client.name}`,
      body: `שלום ${employee.full_name},\n\nהחודש עדיין חסרים ${status.total - status.checkedCount} מתוך ${status.total} טפסים עבור הלקוח "${client.name}".\nלצפייה: היכנסי למערכת מעקב הטפסים.\n`,
    })

    await admin.from('reminder_events').insert({
      client_id: client.id,
      employee_id: employee.id,
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
