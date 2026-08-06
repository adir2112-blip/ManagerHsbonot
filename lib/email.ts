// Reminder email hook — built now, wired to Resend later. Without RESEND_API_KEY, this
// no-ops and returns 'skipped' (not 'failed'), so the cron's nag logic treats it exactly
// like a due-for-retry send: the day the key is added, the next cron run just starts
// delivering everything that was piling up as 'skipped', with zero code changes.
export type SendResult = { status: 'sent' | 'failed' | 'skipped'; error?: string }

export async function sendReminderEmail(opts: { to: string; subject: string; body: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[reminders] RESEND_API_KEY not set — skipping email to ${opts.to}: ${opts.subject}`)
    return { status: 'skipped' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL || 'reminders@example.com',
        to: opts.to,
        subject: opts.subject,
        text: opts.body,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { status: 'failed', error: `Resend ${res.status}: ${text}` }
    }
    return { status: 'sent' }
  } catch (err: any) {
    return { status: 'failed', error: err?.message || 'unknown error' }
  }
}
