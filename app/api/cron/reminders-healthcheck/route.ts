import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email'
import { israelToday } from '@/lib/checklist'

// Runs a few hours after the main reminders cron (vercel.json). The main cron alerts on its
// own if it runs and throws — but if Vercel Cron itself never invokes it (an outage, a
// misconfigured schedule, a deploy that broke the route), nothing else would notice. This is
// that outside observer: if app_settings.last_reminder_run_at isn't from today (Israel time)
// by the time this runs, the main cron didn't fire, and we alert on that directly.
async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: settings } = await admin.from('app_settings').select('last_reminder_run_at').single()
  const today = israelToday()

  const lastRunDay = settings?.last_reminder_run_at ? israelToday(new Date(settings.last_reminder_run_at)) : null
  const ranToday = lastRunDay && lastRunDay.year === today.year && lastRunDay.month === today.month && lastRunDay.day === today.day

  if (ranToday) {
    return NextResponse.json({ ok: true, ranToday: true })
  }

  await sendReminderEmail({
    to: process.env.ALERT_EMAIL || process.env.GMAIL_USER || '',
    subject: 'התזכורות היומיות לא רצו היום',
    body: `ריצת התזכורות האוטומטית לא בוצעה היום עד כה (${today.day}/${today.month}/${today.year}). כדאי לבדוק את המערכת ואת ה-Cron ב-Vercel.`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, ranToday: false, alerted: true })
}

export const GET = handle
export const POST = handle
