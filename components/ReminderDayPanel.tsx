'use client'
import { useState } from 'react'
import { apiPatch } from '@/lib/client'

// One shared, office-wide setting: which day of the month a client counts as overdue.
// Any bookkeeper can change it (not admin-only) — same field the admin/settings page edits.
export default function ReminderDayPanel({ currentValue, onClose, onSaved }: { currentValue: number; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(String(currentValue))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await apiPatch('/api/settings', { reminder_day_of_month: Number(value) })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">יום חריגה בחודש</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="form-group">
          <label className="form-label">מהיום הזה בחודש (של הלקוח) הוא ייחשב בפיגור אם לא הושלם</label>
          <input className="form-input" type="number" min={1} max={28} value={value} onChange={e => setValue(e.target.value)} autoFocus />
        </div>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
      </div>
    </div>
  )
}
