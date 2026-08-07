'use client'
import { useState } from 'react'
import DashboardStats from '@/components/DashboardStats'

interface Row {
  client: { id: string; name: string; assigned_employee: { id: string; full_name: string } | null }
  checkedCount: number
  total: number
  complete: boolean
  isBehind: boolean
  daysBehind: number
  completedAt: string | null
}

type Scope = 'office' | 'mine'

// Wraps the "by employee" breakdown + the stat cards/tables in one office-vs-mine toggle, so
// switching scope filters everything on the dashboard consistently in one place.
export default function DashboardContent({ rows, reminderDay, today, currentUserId }: {
  rows: Row[]; reminderDay: number; today: { year: number; month: number }; currentUserId: string
}) {
  const [scope, setScope] = useState<Scope>('office')

  const visibleRows = scope === 'mine' ? rows.filter(r => r.client.assigned_employee?.id === currentUserId) : rows

  const byEmployee = new Map<string, { name: string; behind: number; complete: number; total: number }>()
  for (const r of rows) {
    const key = r.client.assigned_employee?.id || 'unassigned'
    const name = r.client.assigned_employee?.full_name || 'ללא שיוך'
    const entry = byEmployee.get(key) || { name, behind: 0, complete: 0, total: 0 }
    entry.total++
    if (r.isBehind) entry.behind++
    if (r.complete) entry.complete++
    byEmployee.set(key, entry)
  }
  // Most-loaded first — the point of this table is to spot at a glance who needs help.
  const byEmployeeSorted = [...byEmployee.values()].sort((a, b) => b.behind - a.behind)

  return (
    <div>
      <div className="scope-toggle">
        <button className={scope === 'office' ? 'active' : ''} onClick={() => setScope('office')}>🏢 כל המשרד</button>
        <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>👤 הלקוחות שלי</button>
      </div>

      {scope === 'office' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><div className="card-title">לפי עובדת אחראית</div></div>
          <div className="card-pad">
            {byEmployeeSorted.map(e => (
              <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{e.name}</span>
                <span>
                  {e.behind > 0 ? <span className="badge b-red">{e.behind} בפיגור</span> : <span className="badge b-green">הכל בסדר</span>}
                  <span style={{ color: 'var(--text3)', fontSize: 11, marginRight: 8 }}>{e.complete}/{e.total} הושלמו</span>
                </span>
              </div>
            ))}
            {byEmployee.size === 0 && <div className="td-muted">אין לקוחות רלוונטיים החודש</div>}
          </div>
        </div>
      )}

      <DashboardStats rows={visibleRows} reminderDay={reminderDay} today={today} />
    </div>
  )
}
