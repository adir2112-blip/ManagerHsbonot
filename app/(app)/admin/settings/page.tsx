'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/client'

interface Settings { reminder_day_of_month: number; reminder_email_subject: string; reminder_email_body: string }
interface Stage { id: string; days_overdue: number }

export default function SettingsAdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)
  const [stages, setStages] = useState<Stage[]>([])
  const [newStageDays, setNewStageDays] = useState('')
  const [stageError, setStageError] = useState('')

  function loadSettings() {
    apiGet<{ settings: Settings }>('/api/settings').then(d => setSettings(d.settings))
  }
  function loadStages() {
    apiGet<{ stages: Stage[] }>('/api/admin/reminder-stages').then(d => setStages(d.stages))
  }
  useEffect(() => { loadSettings(); loadStages() }, [])

  async function save() {
    if (!settings) return
    await apiPatch('/api/settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addStage(e: React.FormEvent) {
    e.preventDefault()
    setStageError('')
    try {
      await apiPost('/api/admin/reminder-stages', { days_overdue: Number(newStageDays) })
      setNewStageDays('')
      loadStages()
    } catch (err: any) {
      setStageError(err.message || 'שגיאה')
    }
  }

  async function updateStage(id: string, days: string) {
    if (!days) return
    await apiPatch(`/api/admin/reminder-stages/${id}`, { days_overdue: Number(days) })
    loadStages()
  }

  async function removeStage(id: string) {
    await apiDelete(`/api/admin/reminder-stages/${id}`)
    loadStages()
  }

  if (!settings) return <div className="td-muted">טוען…</div>

  return (
    <div>
      <div className="page-header"><div className="page-title">הגדרות תזכורות</div></div>

      <div className="card card-pad" style={{ maxWidth: 480, marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>יום חריגה בדשבורד</div>
        <div className="form-group">
          <label className="form-label">מהיום הזה בחודש לקוח נחשב "בפיגור" בלוח הבקרה</label>
          <input
            className="form-input" type="number" min={1} max={28}
            value={settings.reminder_day_of_month}
            onChange={e => setSettings(s => s && ({ ...s, reminder_day_of_month: Number(e.target.value) }))}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>שמירה</button>
        {saved && <span className="badge b-green" style={{ marginRight: 10 }}>נשמר</span>}
      </div>

      <div className="card card-pad" style={{ maxWidth: 480, marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>שלבי תזכורת מייל ללקוח</div>
        <div className="td-muted" style={{ marginBottom: 12 }}>
          כל שלב שולח מייל אוטומטי ללקוח כשהוא חורג ב-X ימים מתחילת החודש הרלוונטי לו (ולא הגיש עדיין). אפשר להוסיף כמה שלבים שרוצים.
        </div>
        {stages.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>חריגה של</span>
            <input
              className="form-input" type="number" min={1} style={{ width: 80 }}
              defaultValue={s.days_overdue}
              onBlur={e => e.target.value !== String(s.days_overdue) && updateStage(s.id, e.target.value)}
            />
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>ימים</span>
            <button className="btn btn-xs btn-danger" style={{ marginRight: 'auto' }} onClick={() => removeStage(s.id)}>הסרה</button>
          </div>
        ))}
        {stages.length === 0 && <div className="td-muted" style={{ marginBottom: 12 }}>אין שלבים מוגדרים — לא יישלחו תזכורות אוטומטיות ללקוחות</div>}
        <form onSubmit={addStage} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="form-input" type="number" min={1} placeholder="מספר ימים" style={{ width: 120 }} value={newStageDays} onChange={e => setNewStageDays(e.target.value)} required />
          <button className="btn btn-sm" type="submit">+ הוספת שלב</button>
        </form>
        {stageError && <div className="badge b-red" style={{ marginTop: 10 }}>{stageError}</div>}
      </div>

      <div className="card card-pad" style={{ maxWidth: 480 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>נוסח מייל התזכורת ללקוח</div>
        <div className="td-muted" style={{ marginBottom: 12 }}>
          אפשר להשתמש ב-<code>{'{{שם_לקוח}}'}</code> ו-<code>{'{{רשימת_טפסים}}'}</code> — יוחלפו אוטומטית בזמן השליחה.
        </div>
        <div className="form-group">
          <label className="form-label">נושא המייל</label>
          <input
            className="form-input"
            value={settings.reminder_email_subject}
            onChange={e => setSettings(s => s && ({ ...s, reminder_email_subject: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">גוף המייל</label>
          <textarea
            className="form-input"
            rows={8}
            style={{ fontFamily: 'Heebo, sans-serif', resize: 'vertical' }}
            value={settings.reminder_email_body}
            onChange={e => setSettings(s => s && ({ ...s, reminder_email_body: e.target.value }))}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>שמירה</button>
        {saved && <span className="badge b-green" style={{ marginRight: 10 }}>נשמר</span>}
      </div>
    </div>
  )
}
