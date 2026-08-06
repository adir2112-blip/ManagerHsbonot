// Shared by the daily cron and the client card's manual "שלח מייל תזכורת" button — both fill
// the SAME admin-editable template (app_settings.reminder_email_subject/body), so wording only
// needs updating in one place (admin/settings) to change every future send.
export function renderClientReminderEmail(
  template: { subject: string; body: string },
  clientName: string,
  missingFormNames: string[]
) {
  const list = missingFormNames.map(n => `• ${n}`).join('\n')
  const fill = (s: string) => s.replaceAll('{{שם_לקוח}}', clientName).replaceAll('{{רשימת_טפסים}}', list)
  return { subject: fill(template.subject), body: fill(template.body) }
}
