'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/client'

interface Employee { id: string; full_name: string }

export default function NewClientPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [name, setName] = useState('')
  const [cycle, setCycle] = useState<'monthly' | 'bimonthly'>('monthly')
  const [cycleStartDate, setCycleStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet<{ employees: Employee[] }>('/api/employees').then(d => setEmployees(d.employees)).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { client } = await apiPost<{ client: { id: string } }>('/api/clients', {
        name, cycle, cycle_start_date: cycleStartDate,
        assigned_employee_id: assignedEmployeeId || null,
        notes: notes || null,
      })
      router.push(`/clients/${client.id}`)
    } catch (err: any) {
      setError(err.message || 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header"><div className="page-title">לקוח חדש</div></div>
      <form className="card card-pad" onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="form-group">
          <label className="form-label">שם הלקוח</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">מחזוריות</label>
            <select className="form-input" value={cycle} onChange={e => setCycle(e.target.value as any)}>
              <option value="monthly">חודשי</option>
              <option value="bimonthly">דו-חודשי</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{cycle === 'bimonthly' ? 'תאריך הגשה ראשון' : 'תאריך התחלה'}</label>
            <input className="form-input" type="date" value={cycleStartDate} onChange={e => setCycleStartDate(e.target.value)} required />
          </div>
        </div>
        {cycle === 'bimonthly' && (
          <div className="dynamic-banner">מהחודש שנבחר, הלקוח יופיע בתצוגה החודשית כל חודשיים בלבד. ניתן לתקן תאריך זה בהמשך מכרטיס הלקוח.</div>
        )}
        <div className="form-group">
          <label className="form-label">עובדת אחראית</label>
          <select className="form-input" value={assignedEmployeeId} onChange={e => setAssignedEmployeeId(e.target.value)}>
            <option value="">ללא שיוך</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">הערה חופשית (אופציונלי)</label>
          <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        {error && <div className="badge b-red" style={{ marginBottom: 14 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'שומר…' : 'צור לקוח'}</button>
      </form>
    </div>
  )
}
