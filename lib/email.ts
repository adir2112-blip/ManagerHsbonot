// Reminder email hook. Two possible senders, tried in order:
//   1. Resend (RESEND_API_KEY) — the "real" path once a verified domain exists.
//   2. Gmail SMTP relay (GMAIL_USER + GMAIL_APP_PASSWORD) — free, no domain needed, used as
//      an interim sender since Resend's sandbox mode can only deliver to its own account owner
//      until a domain is verified.
// With neither configured, this no-ops and returns 'skipped' (not 'failed'), so the cron's nag
// logic treats it exactly like a due-for-retry send — the day either is added, the next cron
// run just starts delivering everything that was piling up as 'skipped', with zero code changes.
export type SendResult = { status: 'sent' | 'failed' | 'skipped'; error?: string }

async function sendViaResend(opts: { to: string; subject: string; body: string }): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
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

async function sendViaGmail(opts: { to: string; subject: string; body: string }): Promise<SendResult> {
  try {
    // Lazy import — nodemailer is only needed on this path, no reason to load it otherwise.
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
    })
    return { status: 'sent' }
  } catch (err: any) {
    return { status: 'failed', error: err?.message || 'unknown error' }
  }
}

export async function sendReminderEmail(opts: { to: string; subject: string; body: string }): Promise<SendResult> {
  if (process.env.RESEND_API_KEY) return sendViaResend(opts)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return sendViaGmail(opts)
  console.log(`[reminders] no email sender configured — skipping email to ${opts.to}: ${opts.subject}`)
  return { status: 'skipped' }
}
