'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiGet, apiPatch } from '@/lib/client'

interface Reminder {
  id: string; remind_at: string; note: string | null; is_done: boolean
  client: { id: string; name: string } | null
  form_type: { id: string; name: string } | null
}

type Scope = 'mine' | 'all'
type StatusFilter = 'open' | 'done'

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export default function RemindersCalendar({ isAdmin }: { isAdmin: boolean }) {
  const [scope, setScope] = useState<Scope>('mine')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    apiGet<{ reminders: Reminder[] }>(`/api/reminders?scope=${scope}`)
      .then(d => setReminders(d.reminders || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  async function markDone(id: string, done: boolean) {
    setReminders(rs => rs.map(r => r.id === id ? { ...r, is_done: done } : r))
    await apiPatch(`/api/reminders/${id}`, { is_done: done })
  }

  const filtered = reminders.filter(r => statusFilter === 'open' ? !r.is_done : r.is_done)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🔔 תזכורות</div>
      </div>

      <div className="filter-pills" style={{ marginBottom: 16, justifyContent: 'space-between', display: 'flex' }}>
        <div className="filter-pills">
          <button className={`pill${statusFilter === 'open' ? ' active' : ''}`} onClick={() => setStatusFilter('open')}>פתוחות</button>
          <button className={`pill${statusFilter === 'done' ? ' active' : ''}`} onClick={() => setStatusFilter('done')}>טופלו</button>
        </div>
        {isAdmin && (
          <div className="filter-pills">
            <button className={`pill${scope === 'mine' ? ' active' : ''}`} onClick={() => setScope('mine')}>שלי</button>
            <button className={`pill${scope === 'all' ? ' active' : ''}`} onClick={() => setScope('all')}>כל המשרד</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>תאריך ושעה</th><th>לקוח</th><th>טופס</th><th>הערה</th><th></th></tr></thead>
            <tbody>
              {!loading && filtered.map(r => (
                <tr key={r.id}>
                  <td className="td-mono">{fmtDateTime(r.remind_at)}</td>
                  <td>{r.client ? <Link href={`/clients/${r.client.id}`}>{r.client.name}</Link> : '—'}</td>
                  <td>{r.form_type?.name || '—'}</td>
                  <td>{r.note || '—'}</td>
                  <td>
                    {statusFilter === 'open'
                      ? <button className="btn btn-xs" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }} onClick={() => markDone(r.id, true)}>✓ טופל</button>
                      : <button className="btn btn-xs" onClick={() => markDone(r.id, false)}>↺ פתיחה מחדש</button>}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="td-muted">אין תזכורות {statusFilter === 'open' ? 'פתוחות' : 'שטופלו'}</td></tr>}
              {loading && <tr><td colSpan={5} className="td-muted">טוען…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
