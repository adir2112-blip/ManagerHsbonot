'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPatch } from '@/lib/client'
import ReminderBell from '@/components/ReminderBell'

interface FormType { id: string; name: string; sort_order: number }
interface ChecklistItemRow {
  id: string; form_type_id: string; checked: boolean; note: string | null
  checked_at: string | null; checked_by_profile: { full_name: string } | null
  continue_treatment: boolean
}

function formatWho(item: ChecklistItemRow): string | null {
  if (!item.checked || !item.checked_by_profile) return null
  const who = item.checked_by_profile.full_name
  if (!item.checked_at) return `סומן ע"י ${who}`
  const d = new Date(item.checked_at)
  const date = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
  return `סומן ע"י ${who} • ${date} ${time}`
}

export default function ChecklistMonth({ clientId, year, month, onChanged }: { clientId: string; year: number; month: number; onChanged?: () => void }) {
  const router = useRouter()
  const [formTypes, setFormTypes] = useState<FormType[]>([])
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  function load(silent = false) {
    if (!silent) setLoading(true)
    return apiGet<{ formTypes: FormType[]; items: ChecklistItemRow[] }>(`/api/clients/${clientId}/checklist?year=${year}&month=${month}`)
      .then(d => { setFormTypes(d.formTypes); setItems(d.items) })
      .finally(() => !silent && setLoading(false))
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
      : [...items, { id: 'temp', form_type_id: formTypeId, checked, note: null, checked_at: null, checked_by_profile: null, continue_treatment: false }])
    try {
      await apiPatch(`/api/clients/${clientId}/checklist`, { form_type_id: formTypeId, year, month, checked })
      await load(true) // silent refresh — picks up who/when without a loading flash
      onChanged?.()
    } catch {
      setItems(prev) // revert on failure
    }
  }

  // "המשך טיפול" — an internal override, separate from `checked`: keeps this month reading as
  // incomplete (client card, dashboard) until someone explicitly clears it, even if every box
  // is checked. For paperwork that's in from the client but not actually closed out internally.
  async function toggleContinueTreatment(formTypeId: string) {
    const prev = items
    const existing = itemFor(formTypeId)
    const next = !existing?.continue_treatment
    setItems(existing
      ? items.map(i => i.form_type_id === formTypeId ? { ...i, continue_treatment: next } : i)
      : [...items, { id: 'temp', form_type_id: formTypeId, checked: false, note: null, checked_at: null, checked_by_profile: null, continue_treatment: next }])
    try {
      await apiPatch(`/api/clients/${clientId}/checklist`, { form_type_id: formTypeId, year, month, continue_treatment: next })
      await load(true)
      onChanged?.()
    } catch {
      setItems(prev)
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
        const who = item ? formatWho(item) : null
        return (
          <div key={ft.id} className="checklist-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={!!item?.checked}
              onChange={e => toggle(ft.id, e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
            />
            <span className="ct-label" style={{ flex: '0 0 200px', fontWeight: 600, fontSize: 13 }}>{ft.name}</span>
            <input
              className="form-input ct-note"
              placeholder="הערה חופשית (אופציונלי)"
              value={noteDrafts[ft.id] ?? item?.note ?? ''}
              onChange={e => setNoteDrafts(d => ({ ...d, [ft.id]: e.target.value }))}
              onBlur={() => saveNote(ft.id)}
              style={{ flex: 1, fontSize: 12, padding: '5px 9px' }}
            />
            <button
              className="btn btn-xs"
              onClick={() => toggleContinueTreatment(ft.id)}
              title="גם אם כל הטפסים מסומנים, הלקוח יישאר בטיפול עד שהכפתור יבוטל"
              style={item?.continue_treatment ? { background: 'var(--amber-lt)', color: 'var(--amber)', borderColor: 'rgba(180,83,9,0.3)' } : undefined}
            >
              {item?.continue_treatment ? '⏳ בהמשך טיפול' : 'המשך טיפול'}
            </button>
            <ReminderBell clientId={clientId} formTypeId={ft.id} />
            {who && <div style={{ flex: '1 1 100%', fontSize: 11, color: 'var(--text3)', paddingRight: 28 }}>{who}</div>}
          </div>
        )
      })}
    </div>
  )
}
