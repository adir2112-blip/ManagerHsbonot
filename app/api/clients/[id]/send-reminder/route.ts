import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { isMonthRelevant, missingFormTypes, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'
import { renderClientReminderEmail } from '@/lib/client-reminder-email'
import { sendReminderEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'

// Manual "שלח מייל תזכורת" button on the client card — sends the SAME template as the
// automatic staged reminders, right now, regardless of stage/day thresholds. Recorded with
// stage_days_overdue = null so the history can tell manual sends apart from automatic ones.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const { data: client } = await ctx.supabase.from('clients').select('*').eq('id', params.id).single()
  if (!client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
  if (!client.email) return NextResponse.json({ error: 'ללקוח הזה אין כתובת מייל מוגדרת' }, { status: 400 })

  const today = israelToday()
  if (!isMonthRelevant(client.cycle, client.cycle_start_date, today.year, today.month)) {
    return NextResponse.json({ error: 'אין חודש רלוונטי ללקוח זה כרגע' }, { status: 400 })
  }

  const [{ data: allFormTypes }, { data: items }, formTypeMap, { data: settings }] = await Promise.all([
    ctx.supabase.from('form_types').select('*'),
    ctx.supabase.from('checklist_items').select('*').eq('client_id', params.id).eq('year', today.year).eq('month', today.month),
    fetchClientFormTypeMap(ctx.supabase, [params.id]),
    ctx.supabase.from('app_settings').select('*').single(),
  ])
  const selectedIds = formTypeMap.get(params.id) || new Set()
  const clientFormTypes = (allFormTypes || []).filter(ft => selectedIds.has(ft.id))
  const missing = missingFormTypes(clientFormTypes, items || [], today.year, today.month)

  if (missing.length === 0) {
    return NextResponse.json({ error: 'כל הטפסים כבר הוגשו החודש — אין מה להזכיר' }, { status: 400 })
  }

  const template = { subject: settings?.reminder_email_subject || '', body: settings?.reminder_email_body || '' }
  const { subject, body } = renderClientReminderEmail(template, client.name, missing.map((f: any) => f.name))
  const result = await sendReminderEmail({ to: client.email, subject, body })

  // reminder_events has no INSERT policy for regular users (only the service-role cron writes
  // there, by design, so the automated log can't be tampered with) — this manual-send path is
  // a second trusted writer, so it needs the admin client for just this one write.
  const admin = createAdminClient()
  const { data: event, error } = await admin
    .from('reminder_events')
    .insert({
      client_id: client.id,
      employee_id: client.assigned_employee_id || null,
      year: today.year,
      month: today.month,
      status: result.status,
      error_message: result.error || null,
      sent_at: new Date().toISOString(),
      stage_days_overdue: null, // manual send
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (result.status === 'failed') return NextResponse.json({ error: result.error || 'שליחת המייל נכשלה' }, { status: 500 })
  if (result.status === 'skipped') return NextResponse.json({ error: 'לא הוגדר ספק מייל במערכת' }, { status: 400 })
  return NextResponse.json({ ok: true, event })
}
