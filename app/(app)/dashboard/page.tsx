import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/server'
import { isMonthRelevant, computeMonthStatus, israelToday } from '@/lib/checklist'

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export default async function DashboardPage() {
  const ctx = await getCurrentUser()
  if (!ctx) return null
  const { supabase } = ctx

  const today = israelToday()
  const [{ data: clients }, { data: formTypes }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from('clients').select('*, assigned_employee:assigned_employee_id(id, full_name)').eq('active', true),
    supabase.from('form_types').select('*'),
    supabase.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    supabase.from('app_settings').select('*').single(),
  ])

  const reminderDay = settings?.reminder_day_of_month ?? 10

  // Only clients whose cycle makes THIS month relevant show up at all — a bimonthly client
  // in its off month is simply absent, never shown as "not relevant".
  const relevant = (clients || []).filter(c => isMonthRelevant(c.cycle, c.cycle_start_date, today.year, today.month))

  const rows = relevant.map(c => {
    const clientItems = (items || []).filter(i => i.client_id === c.id)
    const clientStatus = computeMonthStatus(formTypes || [], clientItems, today.year, today.month)
    const isBehind = !clientStatus.complete && today.day >= reminderDay
    const daysBehind = isBehind ? today.day - reminderDay : 0
    return { client: c, ...clientStatus, isBehind, daysBehind }
  })

  const completeCount = rows.filter(r => r.complete).length
  const behindCount = rows.filter(r => r.isBehind).length
  const inProgressCount = rows.length - completeCount - behindCount

  const byEmployee = new Map<string, { name: string; behind: number; total: number }>()
  for (const r of rows) {
    const key = r.client.assigned_employee?.id || 'unassigned'
    const name = r.client.assigned_employee?.full_name || 'ללא שיוך'
    const entry = byEmployee.get(key) || { name, behind: 0, total: 0 }
    entry.total++
    if (r.isBehind) entry.behind++
    byEmployee.set(key, entry)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">לוח בקרה — {HEBREW_MONTHS[today.month - 1]} {today.year}</div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-lt)', color: 'var(--green)' }}>✓</div>
          <div className="stat-num" style={{ color: 'var(--green)' }}>{completeCount}</div>
          <div className="stat-lbl">הושלמו החודש</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--amber-lt)', color: 'var(--amber)' }}>…</div>
          <div className="stat-num" style={{ color: 'var(--amber)' }}>{inProgressCount}</div>
          <div className="stat-lbl">בטיפול</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--red-lt)', color: 'var(--red)' }}>!</div>
          <div className="stat-num" style={{ color: 'var(--red)' }}>{behindCount}</div>
          <div className="stat-lbl">בפיגור</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">לפי עובדת אחראית</div></div>
        <div className="card-pad">
          {[...byEmployee.values()].map(e => (
            <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{e.name}</span>
              <span>
                {e.behind > 0 ? <span className="badge b-red">{e.behind} בפיגור</span> : <span className="badge b-green">הכל בסדר</span>}
                <span style={{ color: 'var(--text3)', fontSize: 11, marginRight: 8 }}>מתוך {e.total} לקוחות</span>
              </span>
            </div>
          ))}
          {byEmployee.size === 0 && <div className="td-muted">אין לקוחות רלוונטיים החודש</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">לקוחות בפיגור</div>
          <Link href="/clients" className="btn btn-sm">כל הלקוחות ←</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>לקוח</th><th>עובדת אחראית</th><th>התקדמות</th><th>ימי פיגור</th></tr></thead>
            <tbody>
              {rows.filter(r => r.isBehind).map(r => (
                <tr key={r.client.id} className="overdue-row">
                  <td><Link href={`/clients/${r.client.id}`}>{r.client.name}</Link></td>
                  <td>{r.client.assigned_employee?.full_name || '—'}</td>
                  <td>{r.checkedCount}/{r.total}</td>
                  <td><span className="overdue-label">{r.daysBehind} ימים</span></td>
                </tr>
              ))}
              {behindCount === 0 && <tr><td colSpan={4} className="td-muted">אין לקוחות בפיגור 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
