'use client'
import { useState } from 'react'
import { apiPost } from '@/lib/client'

// "Client asked to be called back tomorrow at 10 about the VAT form" becomes a personal
// reminder tied to this client+task, which pops up for whoever created it (see Topbar's
// polling) and shows on their personal reminders calendar. A centered modal (not a floating
// popover) — a small absolutely-positioned panel here would clip off-screen on mobile or
// inside a nested popup (e.g. the dashboard's "אילו משימות" modal).
export default function ReminderBell({ clientId, formTypeId }: { clientId: string; formTypeId: string }) {
  const [open, setOpen] = useState(false)
  const [remindAt, setRemindAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [justCreated, setJustCreated] = useState(false)

  async function create() {
    if (!remindAt) return
    setSaving(true)
    try {
      await apiPost('/api/reminders', { client_id: clientId, form_type_id: formTypeId, remind_at: new Date(remindAt).toISOString(), note: note || null })
      setOpen(false)
      setRemindAt('')
      setNote('')
      setJustCreated(true)
      setTimeout(() => setJustCreated(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-xs"
        onClick={() => setOpen(true)}
        title="קביעת תזכורת אישית"
        style={justCreated ? { background: 'var(--green-lt)', color: 'var(--green)', flexShrink: 0 } : { flexShrink: 0 }}
      >
        {justCreated ? '✓' : '🔔'}
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => !saving && setOpen(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔔 קביעת תזכורת אישית</div>
              <button className="close-btn" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">תאריך ושעה</label>
              <input className="form-input" type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">הערה (אופציונלי)</label>
              <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="לדוגמה: תחזרי אליי" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={create} disabled={saving || !remindAt}>
                {saving ? 'שומר…' : 'קביעת תזכורת'}
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)} disabled={saving}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
