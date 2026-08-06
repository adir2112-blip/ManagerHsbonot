'use client'
import { useState } from 'react'
import { apiPost } from '@/lib/client'

// Small popover on a bell icon — "client asked to be called back tomorrow at 10 about the VAT
// form" becomes a personal reminder tied to this client+task, which pops up for whoever created
// it (see Topbar's polling) and shows on their personal reminders calendar.
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
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        className="btn btn-xs"
        onClick={() => setOpen(o => !o)}
        title="קביעת תזכורת אישית"
        style={justCreated ? { background: 'var(--green-lt)', color: 'var(--green)' } : undefined}
      >
        {justCreated ? '✓' : '🔔'}
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 12, zIndex: 100, width: 240 }}
        >
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">תאריך ושעה</label>
            <input className="form-input" type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)} autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">הערה (אופציונלי)</label>
            <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="לדוגמה: תחזרי אליי" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-primary btn-xs" style={{ flex: 1, justifyContent: 'center' }} onClick={create} disabled={saving || !remindAt}>
              {saving ? 'שומר…' : 'קביעת תזכורת'}
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setOpen(false)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  )
}
