'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { apiGet, apiPatch } from '@/lib/client'
import ChecklistMonth from '@/components/ChecklistMonth'

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

interface Employee { id: string; full_name: string }
interface Client {
  id: string; name: string; cycle: 'monthly' | 'bimonthly'; cycle_start_date: string
  assigned_employee_id: string | null; assigned_employee: Employee | null; notes: string | null; active: boolean
}
interface HistoryRow { year: number; month: number; total: number; checkedCount: number; complete: boolean }

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editCycleStart, setEditCycleStart] = useState('')
  const [editAssignee, setEditAssignee] = useState('')

  const load = useCallback(() => {
    apiGet<{ client: Client; history: HistoryRow[] }>(`/api/clients/${params.id}`).then(d => {
      setClient(d.client)
      setHistory(d.history)
      setEditCycleStart(d.client.cycle_start_date)
      setEditAssignee(d.client.assigned_employee_id || '')
      if (!expanded && d.history.length > 0) setExpanded(`${d.history[0].year}-${d.history[0].month}`)
    })
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiGet<{ employees: Employee[] }>('/api/employees').then(d => setEmployees(d.employees))
    load()
  }, [load])

  async function saveEdit() {
    await apiPatch(`/api/clients/${params.id}`, { cycle_start_date: editCycleStart, assigned_employee_id: editAssignee || null })
    setEditing(false)
    load()
  }

  if (!client) return <div className="td-muted">טוען…</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{client.name}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
            <span className="chip">{client.cycle === 'monthly' ? 'חודשי' : 'דו-חודשי'}</span>
            <span className="chip">עובדת אחראית: {client.assigned_employee?.full_name || 'ללא שיוך'}</span>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => setEditing(e => !e)}>{editing ? 'ביטול' : 'עריכה'}</button>
      </div>

      {editing && (
        <div className="card card-pad" style={{ marginBottom: 20, maxWidth: 480 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">תאריך הגשה ראשון (עוגן מחזוריות)</label>
              <input className="form-input" type="date" value={editCycleStart} onChange={e => setEditCycleStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">עובדת אחראית</label>
              <select className="form-input" value={editAssignee} onChange={e => setEditAssignee(e.target.value)}>
                <option value="">ללא שיוך</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>שמירה</button>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title">היסטוריה חודשית</div></div>
        <div>
          {history.map(h => {
            const key = `${h.year}-${h.month}`
            const isOpen = expanded === key
            return (
              <div key={key}>
                <div
                  onClick={() => setExpanded(isOpen ? null : key)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600 }}>{HEBREW_MONTHS[h.month - 1]} {h.year}</span>
                  <span>
                    {h.complete ? <span className="badge b-green">✓ הושלם</span> : <span className="badge b-amber">{h.checkedCount}/{h.total}</span>}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 18px 14px' }}>
                    <ChecklistMonth clientId={client.id} year={h.year} month={h.month} onChanged={load} />
                  </div>
                )}
              </div>
            )
          })}
          {history.length === 0 && <div className="td-muted" style={{ padding: 18 }}>אין עדיין חודשים רלוונטיים ללקוח זה</div>}
        </div>
      </div>
    </div>
  )
}
