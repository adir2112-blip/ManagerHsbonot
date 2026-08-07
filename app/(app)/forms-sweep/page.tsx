'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiGet, apiPatch } from '@/lib/client'

interface FormType { id: string; name: string }
interface SweepRow { client_id: string; client_name: string; assigned_employee: string | null; checked: boolean }

export default function FormsSweepPage() {
  const [formTypes, setFormTypes] = useState<FormType[]>([])
  const [selected, setSelected] = useState('')
  const [rows, setRows] = useState<SweepRow[]>([])
  const [today, setToday] = useState<{ year: number; month: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiGet<{ formTypes: FormType[] }>('/api/forms-sweep').then(d => setFormTypes(d.formTypes))
  }, [])

  useEffect(() => {
    if (!selected) { setRows([]); return }
    setLoading(true)
    apiGet<{ today: { year: number; month: number }; clients: SweepRow[] }>(`/api/forms-sweep?formTypeId=${selected}`)
      .then(d => { setRows(d.clients); setToday(d.today) })
      .finally(() => setLoading(false))
  }, [selected])

  async function toggle(row: SweepRow) {
    if (!today) return
    const next = !row.checked
    setRows(rs => rs.map(r => r.client_id === row.client_id ? { ...r, checked: next } : r))
    await apiPatch(`/api/clients/${row.client_id}/checklist`, {
      form_type_id: selected, year: today.year, month: today.month, checked: next,
    })
  }

  const remaining = rows.filter(r => !r.checked).length

  return (
    <div>
      <div className="page-header">
        <div className="page-title">בדיקה לפי סוג טופס</div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 480, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">בחר/י סוג טופס</label>
          <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— בחר —</option>
            {formTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="td-muted">טוען…</div>}

      {!loading && selected && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              {formTypes.find(f => f.id === selected)?.name} — {remaining > 0 ? `${remaining} עדיין חסרים` : 'הכל הוגש ✓'}
            </div>
          </div>
          <div className="card-pad">
            {rows.length === 0 && <div className="td-muted">אין לקוחות רלוונטיים לסוג טופס זה החודש</div>}
            {rows.map(r => (
              <div key={r.client_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={r.checked} onChange={() => toggle(r)} />
                  <Link href={`/clients/${r.client_id}`}>{r.client_name}</Link>
                </label>
                {r.assigned_employee && <span className="td-muted" style={{ fontSize: 12 }}>{r.assigned_employee}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
