'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/client'

interface UserRow {
  id: string; username: string; full_name: string; role: 'admin' | 'bookkeeper'
  active: boolean; notification_email: string | null
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'bookkeeper', notification_email: '' })
  const [error, setError] = useState('')
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  function load() {
    apiGet<{ users: UserRow[] }>('/api/admin/users').then(d => setUsers(d.users))
  }
  useEffect(() => { load() }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiPost('/api/admin/users', form)
      setForm({ username: '', password: '', full_name: '', role: 'bookkeeper', notification_email: '' })
      setShowNew(false)
      load()
    } catch (err: any) {
      setError(err.message || 'שגיאה')
    }
  }

  async function toggleActive(u: UserRow) {
    await apiPatch(`/api/admin/users/${u.id}`, { active: !u.active })
    load()
  }

  async function changeRole(u: UserRow, role: string) {
    await apiPatch(`/api/admin/users/${u.id}`, { role })
    load()
  }

  async function submitReset(id: string) {
    setError('')
    try {
      await apiPost(`/api/admin/users/${id}/reset-password`, { password: resetPassword })
      setResetTarget(null)
      setResetPassword('')
    } catch (err: any) {
      setError(err.message || 'שגיאה')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">משתמשים</div>
        <button className="btn btn-primary" onClick={() => setShowNew(s => !s)}>{showNew ? 'ביטול' : '+ עובדת חדשה'}</button>
      </div>

      {showNew && (
        <form onSubmit={createUser} className="card card-pad" style={{ marginBottom: 20, maxWidth: 480 }}>
          <div className="form-group">
            <label className="form-label">שם משתמש (לכניסה למערכת)</label>
            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">שם מלא</label>
            <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">סיסמה ראשונית</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">אימייל לתזכורות (אמיתי — לא שם המשתמש)</label>
            <input className="form-input" type="email" value={form.notification_email} onChange={e => setForm(f => ({ ...f, notification_email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">תפקיד</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="bookkeeper">הנהלת חשבונות</option>
              <option value="admin">מנהל ראשי</option>
            </select>
          </div>
          {error && <div className="badge b-red" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn btn-primary btn-sm" type="submit">יצירה</button>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>שם משתמש</th><th>שם מלא</th><th>תפקיד</th><th>אימייל לתזכורות</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="td-mono">{u.username}</td>
                  <td>{u.full_name}</td>
                  <td>
                    <select className="form-input" style={{ padding: '3px 8px', fontSize: 12 }} value={u.role} onChange={e => changeRole(u, e.target.value)}>
                      <option value="bookkeeper">הנהלת חשבונות</option>
                      <option value="admin">מנהל ראשי</option>
                    </select>
                  </td>
                  <td className="td-muted">{u.notification_email || '—'}</td>
                  <td>{u.active ? <span className="badge b-green">פעיל</span> : <span className="badge b-gray">מושבת</span>}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-xs" onClick={() => toggleActive(u)}>{u.active ? 'השבתה' : 'הפעלה'}</button>
                    <button className="btn btn-xs" onClick={() => setResetTarget(u.id)}>איפוס סיסמה</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">איפוס סיסמה</div></div>
            <div className="form-group">
              <label className="form-label">סיסמה חדשה</label>
              <input className="form-input" type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
            </div>
            {error && <div className="badge b-red" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="btn btn-primary btn-sm" onClick={() => submitReset(resetTarget)}>עדכון</button>
          </div>
        </div>
      )}
    </div>
  )
}
