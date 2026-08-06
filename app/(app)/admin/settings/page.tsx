'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/client'

interface Settings { reminder_day_of_month: number; reminder_interval_days: number }

export default function SettingsAdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiGet<{ settings: Settings }>('/api/settings').then(d => setSettings(d.settings))
  }, [])

  async function save() {
    if (!settings) return
    await apiPatch('/api/settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return <div className="td-muted">טוען…</div>

  return (
    <div>
      <div className="page-header"><div className="page-title">הגדרות תזכורות</div></div>
      <div className="card card-pad" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label className="form-label">יום בחודש לתחילת תזכורות</label>
          <input
            className="form-input" type="number" min={1} max={28}
            value={settings.reminder_day_of_month}
            onChange={e => setSettings(s => s && ({ ...s, reminder_day_of_month: Number(e.target.value) }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">כל כמה ימים לשלוח תזכורת חוזרת (כל עוד לא הושלם)</label>
          <input
            className="form-input" type="number" min={1} max={30}
            value={settings.reminder_interval_days}
            onChange={e => setSettings(s => s && ({ ...s, reminder_interval_days: Number(e.target.value) }))}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>שמירה</button>
        {saved && <span className="badge b-green" style={{ marginRight: 10 }}>נשמר</span>}
      </div>
    </div>
  )
}
