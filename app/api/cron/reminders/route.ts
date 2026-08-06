import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email'
import { isMonthRelevant, missingFormTypes, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'
import { renderClientReminderEmail } from '@/lib/client-reminder-email'

// Runs daily via Vercel Cron (vercel.json), which invokes with GET and auto-attaches
// "Authorization: Bearer $CRON_SECRET". Also exported as POST for manual curl testing.
// Uses the service-role client (bypasses RLS) — this is a system context, not a user
// session, matching reminder_events' RLS (no write policy exists for regular users, only reads).
//
// Goes to the CLIENT directly (clients.email) — NOT the assigned employee. employee_id on
// reminder_events is kept only as a reference to who owns the client, not a recipient.
//
// Multi-stage schedule (admin-editable in reminder_stages, e.g. day 5 → day 10 → ...): for
// each client, find the LATEST stage already sent this month, then send the NEXT stage whose
// threshold has been reached — one stage per day at most, so a cron outage doesn't dump
// several stages on someone at once when it catches back up.
async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = israelToday()

  const [{ data: clients }, { data: formTypes }, { data: settings }, { data: stages }] = await Promise.all([
    admin.from('clients').select('*, assigned_employee:assigned_employee_id(id, full_name)').eq('active', true),
    admin.from('form_types').select('*'),
    admin.from('app_settings').select('*').single(),
    admin.from('reminder_stages').select('*').order('days_overdue'),
  ])

  const template = { subject: settings?.reminder_email_subject || '', body: settings?.reminder_email_body || '' }
  const clientIds = (clients || []).map(c => c.id)
  const formTypeMap = await fetchClientFormTypeMap(admin, clientIds)

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

    const missing = missingFormTypes(clientFormTypes, items || [], today.year, today.month)
    if (missing.length === 0) continue // complete

    const { data: sentStages } = await admin
      .from('reminder_events')
      .select('stage_days_overdue')
      .eq('client_id', client.id)
      .eq('year', today.year)
      .eq('month', today.month)
      .eq('status', 'sent')
      .not('stage_days_overdue', 'is', null)

    const lastSentStage = Math.max(0, ...(sentStages || []).map(s => s.stage_days_overdue as number))
    const nextStage = (stages || [])
      .filter(s => s.days_overdue > lastSentStage && s.days_overdue <= today.day)
      .sort((a, b) => a.days_overdue - b.days_overdue)[0]

    if (!nextStage) { notDue++; continue }

    const { subject, body } = renderClientReminderEmail(template, client.name, missing.map((f: any) => f.name))
    const result = await sendReminderEmail({ to: client.email, subject, body })

    await admin.from('reminder_events').insert({
      client_id: client.id,
      employee_id: client.assigned_employee?.id || null,
      year: today.year,
      month: today.month,
      status: result.status,
      error_message: result.error || null,
      sent_at: new Date().toISOString(),
      stage_days_overdue: nextStage.days_overdue,
    })

    if (result.status === 'sent') sent++
    else if (result.status === 'failed') failed++
    else skipped++
  }

  return NextResponse.json({ ok: true, sent, skipped, failed, notDue })
}

export const GET = handle
export const POST = handle
