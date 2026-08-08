'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReminderDayPanel from '@/components/ReminderDayPanel'
import ChecklistMonth from '@/components/ChecklistMonth'

interface Row {
  client: { id: string; name: string; assigned_employee: { id: string; full_name: string } | null }
  checkedCount: number
  total: number
  complete: boolean
  isBehind: boolean
  daysBehind: number
  hasOpenFollowUp: boolean
  completedAt: string | null
}

type Filter = 'complete' | 'inProgress' | 'behind'

function formatCompletedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const datePart = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timePart = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

export default function DashboardStats({ rows, reminderDay, today }: { rows: Row[]; reminderDay: number; today: { year: number; month: number } }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('behind')
  const [showSettings, setShowSettings] = useState(false)
  const [detailClient, setDetailClient] = useState<Row['client'] | null>(null)

  const completeRows = rows.filter(r => r.complete)
  const behindRows = rows.filter(r => r.isBehind)
  const inProgressRows = rows.filter(r => !r.complete && !r.isBehind)

  const filtered = filter === 'complete' ? completeRows : filter === 'inProgress' ? inProgressRows : behindRows
  const titles: Record<Filter, string> = { complete: 'לקוחות שהושלמו', inProgress: 'לקוחות בטיפול', behind: 'לקוחות בפיגור' }
  const emptyLabels: Record<Filter, string> = { complete: 'אין עדיין לקוחות שהושלמו', inProgress: 'אין לקוחות בטיפול', behind: 'אין לקוחות בפיגור 🎉' }

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card clickable" onClick={() => setFilter('complete')} style={filter === 'complete' ? { borderColor: 'var(--green)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--green-lt)', color: 'var(--green)' }}>✓</div>
          <div className="stat-num" style={{ color: 'var(--green)' }}>{completeRows.length}</div>
          <div className="stat-lbl">הושלמו החודש</div>
        </div>
        <div className="stat-card clickable" onClick={() => setFilter('inProgress')} style={filter === 'inProgress' ? { borderColor: 'var(--amber)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--amber-lt)', color: 'var(--amber)' }}>…</div>
          <div className="stat-num" style={{ color: 'var(--amber)' }}>{inProgressRows.length}</div>
          <div className="stat-lbl">בטיפול</div>
        </div>
        <div className="stat-card clickable" onClick={() => setFilter('behind')} style={filter === 'behind' ? { borderColor: 'var(--red)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--red-lt)', color: 'var(--red)' }}>!</div>
          <div className="stat-num" style={{ color: 'var(--red)' }}>{behindRows.length}</div>
          <div className="stat-lbl">בפיגור</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{titles[filter]}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setShowSettings(true)}>⚙ יום חריגה ({reminderDay})</button>
            <Link href="/clients" className="btn btn-sm">כל הלקוחות ←</Link>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>לקוח</th><th>עובדת אחראית</th><th>התקדמות</th>
                {filter === 'behind' && <th>ימי פיגור</th>}
                {filter === 'complete' && <th>תאריך השלמה</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.client.id} className={filter === 'behind' ? 'overdue-row' : undefined}>
                  <td><Link href={`/clients/${r.client.id}`}>{r.client.name}</Link></td>
                  <td>{r.client.assigned_employee?.full_name || '—'}</td>
                  <td>
                    {r.checkedCount}/{r.total}
                    {r.checkedCount === r.total && r.hasOpenFollowUp && (
                      <span className="badge b-amber" style={{ marginRight: 8 }}>✓ המשך טיפול</span>
                    )}
                  </td>
                  {filter === 'behind' && <td><span className="overdue-label">{r.daysBehind} ימים</span></td>}
                  {filter === 'complete' && <td className="td-mono">{formatCompletedAt(r.completedAt)}</td>}
                  <td><button className="btn btn-xs" onClick={() => setDetailClient(r.client)}>📋 אילו משימות</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={filter === 'behind' || filter === 'complete' ? 5 : 4} className="td-muted">{emptyLabels[filter]}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showSettings && (
        <ReminderDayPanel
          currentValue={reminderDay}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); router.refresh() }}
        />
      )}

      {detailClient && (
        <div className="modal-overlay" onClick={() => setDetailClient(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">משימות החודש — {detailClient.name}</div>
              <button className="close-btn" onClick={() => setDetailClient(null)}>×</button>
            </div>
            <ChecklistMonth clientId={detailClient.id} year={today.year} month={today.month} onChanged={() => router.refresh()} />
            <Link href={`/clients/${detailClient.id}`} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              לכרטיס הלקוח המלא ←
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
