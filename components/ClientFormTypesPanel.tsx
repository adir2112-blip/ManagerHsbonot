'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/client'

interface FormTypeRow { id: string; name: string; selected: boolean }

// Client-card modal for choosing which catalog form types apply to THIS client — the
// selection is remembered per client (client_form_types table), replacing the old
// one-template-for-everyone behavior.
export default function ClientFormTypesPanel({ clientId, onClose, onChanged }: { clientId: string; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<FormTypeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<{ formTypes: FormTypeRow[] }>(`/api/clients/${clientId}/form-types`)
      .then(d => setRows(d.formTypes))
      .finally(() => setLoading(false))
  }, [clientId])

  async function toggle(formTypeId: string, selected: boolean) {
    setRows(rs => rs.map(r => r.id === formTypeId ? { ...r, selected } : r))
    await apiPatch(`/api/clients/${clientId}/form-types`, { form_type_id: formTypeId, selected })
    onChanged()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">טפסים ללקוח זה</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {loading && <div className="td-muted">טוען…</div>}
        {!loading && rows.length === 0 && <div className="td-muted">אין טפסים פעילים בקטלוג — הוסיפו מ"קטלוג טפסים"</div>}
        {!loading && rows.map(r => (
          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <input type="checkbox" checked={r.selected} onChange={e => toggle(r.id, e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <span style={{ fontSize: 13 }}>{r.name}</span>
          </label>
        ))}
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={onClose}>סגור</button>
      </div>
    </div>
  )
}
