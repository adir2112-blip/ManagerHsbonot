'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/client'

interface FormType { id: string; name: string; sort_order: number }
interface ChecklistItemRow { id: string; form_type_id: string; checked: boolean; note: string | null }

export default function ChecklistMonth({ clientId, year, month, onChanged }: { clientId: string; year: number; month: number; onChanged?: () => void }) {
  const [formTypes, setFormTypes] = useState<FormType[]>([])
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  function load() {
    setLoading(true)
    apiGet<{ formTypes: FormType[]; items: ChecklistItemRow[] }>(`/api/clients/${clientId}/checklist?year=${year}&month=${month}`)
      .then(d => { setFormTypes(d.formTypes); setItems(d.items) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [clientId, year, month])

  function itemFor(formTypeId: string) {
    return items.find(i => i.form_type_id === formTypeId)
  }

  async function toggle(formTypeId: string, checked: boolean) {
    const prev = items
    const existing = itemFor(formTypeId)
    setItems(existing
      ? items.map(i => i.form_type_id === formTypeId ? { ...i, checked } : i)
      : [...items, { id: 'temp', form_type_id: formTypeId, checked, note: null }])
    try {
      await apiPatch(`/api/clients/${clientId}/checklist`, { form_type_id: formTypeId, year, month, checked })
      onChanged?.()
    } catch {
      setItems(prev) // revert on failure
    }
  }

  async function saveNote(formTypeId: string) {
    const note = noteDrafts[formTypeId] ?? itemFor(formTypeId)?.note ?? ''
    await apiPatch(`/api/clients/${clientId}/checklist`, { form_type_id: formTypeId, year, month, note })
    load()
  }

  if (loading) return <div className="td-muted" style={{ padding: 12 }}>טוען…</div>
  if (formTypes.length === 0) return <div className="td-muted" style={{ padding: 12 }}>אין טפסים פעילים בקטלוג</div>

  return (
    <div>
      {formTypes.map(ft => {
        const item = itemFor(ft.id)
        return (
          <div key={ft.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={!!item?.checked}
              onChange={e => toggle(ft.id, e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{ flex: '0 0 200px', fontWeight: 600, fontSize: 13 }}>{ft.name}</span>
            <input
              className="form-input"
              placeholder="הערה חופשית (אופציונלי)"
              value={noteDrafts[ft.id] ?? item?.note ?? ''}
              onChange={e => setNoteDrafts(d => ({ ...d, [ft.id]: e.target.value }))}
              onBlur={() => saveNote(ft.id)}
              style={{ flex: 1, fontSize: 12, padding: '5px 9px' }}
            />
          </div>
        )
      })}
    </div>
  )
}
