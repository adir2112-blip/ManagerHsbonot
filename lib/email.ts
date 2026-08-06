// Reminder email hook. Two possible senders, tried in order:
//   1. Resend (RESEND_API_KEY) — the "real" path once a verified domain exists.
//   2. Gmail SMTP relay (GMAIL_USER + GMAIL_APP_PASSWORD) — free, no domain needed, used as
//      an interim sender since Resend's sandbox mode can only deliver to its own account owner
//      until a domain is verified.
// With neither configured, this no-ops and returns 'skipped' (not 'failed'), so the cron's nag
// logic treats it exactly like a due-for-retry send — the day either is added, the next cron
// run just starts delivering everything that was piling up as 'skipped', with zero code changes.
export type SendResult = { status: 'sent' | 'failed' | 'skipped'; error?: string }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Plain-text bodies render LTR by default in most mail clients — with no directionality
// markup, a Hebrew message shows up mirrored/left-aligned ("looks bad"). This renders proper
// RTL HTML instead (kept alongside the plain-text version as a fallback): blank-line-separated
// paragraphs, and a paragraph where every line starts with "• " becomes a real bulleted list
// (matches how the admin-editable template writes the missing-forms list).
function textToRtlHtml(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const blocks = paragraphs.map(p => {
    const lines = p.split('\n')
    if (lines.every(l => l.trim().startsWith('•'))) {
      const items = lines.map(l => `<li style="margin-bottom:4px;">${escapeHtml(l.trim().replace(/^•\s*/, ''))}</li>`).join('')
      return `<ul style="margin:0 18px 16px 0;padding:0 18px 0 0;">${items}</ul>`
    }
    return `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
  }).join('')

  return `
<div dir="rtl" style="font-family:Arial,Heebo,sans-serif;background:#f1f3f8;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:18px 24px;color:#ffffff;font-size:16px;font-weight:700;">
      📊 הנהלת החשבונות
    </div>
    <div style="padding:24px;text-align:right;font-size:14px;line-height:1.7;color:#111827;">
      ${blocks}
    </div>
  </div>
</div>`
}

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
        html: textToRtlHtml(opts.body),
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
      html: textToRtlHtml(opts.body),
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
