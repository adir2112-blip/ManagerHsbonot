'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/client'

interface CategoryRow { id: string; name: string; icon: string; kind: 'upload' | 'pickup'; selected: boolean }
interface PortalClient { id: string; name: string; phone: string | null; id_number: string | null; portal_token: string; portal_enabled: boolean }

function portalUrl(token: string) {
  return `${window.location.origin}/portal/${token}`
}

// Client-card modal: ID number (portal login = last 4 digits), personal link + share, and the
// 4–5 document categories this client is asked to submit.
export default function ClientPortalPanel({ clientId, onClose, onChanged }: { clientId: string; onClose: () => void; onChanged?: () => void }) {
  const [client, setClient] = useState<PortalClient | null>(null)
  const [cats, setCats] = useState<CategoryRow[]>([])
  const [idNumber, setIdNumber] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)

  useEffect(() => {
    apiGet<{ client: PortalClient; categories: CategoryRow[] }>(`/api/clients/${clientId}/portal`).then(d => {
      setClient(d.client); setCats(d.categories); setIdNumber(d.client.id_number || '')
    })
  }, [clientId])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2200) }

  async function saveId() {
    setErr('')
    try {
      const d = await apiPatch<{ client: PortalClient }>(`/api/clients/${clientId}/portal`, { id_number: idNumber })
      setClient(d.client); flash('מספר הזהות נשמר'); onChanged?.()
    } catch (e: any) { setErr(e.message) }
  }

  async function toggleCat(id: string, selected: boolean) {
    setCats(cs => cs.map(c => c.id === id ? { ...c, selected } : c))
    await apiPatch(`/api/clients/${clientId}/portal`, { category_id: id, selected })
    onChanged?.()
  }

  async function regenerate() {
    const d = await apiPatch<{ client: PortalClient }>(`/api/clients/${clientId}/portal`, { regenerate: true })
    setClient(d.client); setConfirmRegen(false); flash('נוצר קישור חדש — הקישור הישן הפסיק לעבוד'); onChanged?.()
  }

  async function toggleEnabled() {
    if (!client) return
    const d = await apiPatch<{ client: PortalClient }>(`/api/clients/${clientId}/portal`, { portal_enabled: !client.portal_enabled })
    setClient(d.client); onChanged?.()
  }

  function copy() {
    if (!client) return
    navigator.clipboard.writeText(portalUrl(client.portal_token)).then(() => flash('הקישור הועתק'))
  }

  function whatsapp() {
    if (!client?.phone) return ''
    const digits = client.phone.replace(/\D/g, '').replace(/^0/, '')
    const intl = digits.startsWith('972') ? digits : `972${digits}`
    const text = `שלום ${client.name.split(' ')[0]} 👋\nזה הקישור האישי שלך להעברת מסמכים למשרד (חשבוניות, הוצאות ועוד):\n${portalUrl(client.portal_token)}\nלכניסה יש להקליד את 4 הספרות האחרונות של תעודת הזהות.\nתודה!`
    return `https://web.whatsapp.com/send?phone=${intl}&text=${encodeURIComponent(text)}`
  }

  const hasId = (client?.id_number || '').replace(/\D/g, '').length >= 4

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📤 פורטל מסמכים{client ? ` — ${client.name}` : ''}</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {!client ? <div className="td-muted">טוען…</div> : (
          <>
            <div className="form-group">
              <label className="form-label">מספר תעודת זהות (הכניסה = 4 ספרות אחרונות)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" inputMode="numeric" value={idNumber} onChange={e => setIdNumber(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} placeholder="לדוגמה 012345678" />
                <button className="btn btn-primary btn-sm" onClick={saveId}>שמירה</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">קישור אישי ללקוח</label>
              {!hasId && <div className="dynamic-banner" style={{ background: 'var(--amber-lt)', color: 'var(--amber)', borderColor: 'rgba(180,83,9,0.25)' }}>יש להגדיר מספר זהות לפני שליחת הקישור</div>}
              <div className="form-input" style={{ direction: 'ltr', fontSize: 11, wordBreak: 'break-all', background: 'var(--bg3)' }}>{portalUrl(client.portal_token)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={copy} disabled={!hasId}>🔗 העתקה</button>
                {client.phone && hasId && <a className="btn btn-sm" href={whatsapp()} target="_blank" rel="noreferrer">💬 שליחה בוואטסאפ</a>}
                <a className="btn btn-sm" href={`/portal/${client.portal_token}`} target="_blank" rel="noreferrer">👁 תצוגה</a>
                <button className="btn btn-sm" onClick={toggleEnabled}>{client.portal_enabled ? '⏸ השבתת קישור' : '▶ הפעלת קישור'}</button>
                {!confirmRegen
                  ? <button className="btn btn-sm" onClick={() => setConfirmRegen(true)}>♻ קישור חדש</button>
                  : <button className="btn btn-sm btn-danger" onClick={regenerate}>אישור — הישן יבוטל</button>}
              </div>
              {!client.portal_enabled && <div className="badge b-gray" style={{ marginTop: 8 }}>הקישור מושבת — הלקוח לא יוכל להיכנס</div>}
            </div>

            <div className="form-group">
              <label className="form-label">מה הלקוח נדרש להעביר</label>
              {cats.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={c.selected} onChange={e => toggleCat(c.id, e.target.checked)} style={{ width: 18, height: 18 }} />
                  <span>{c.icon} {c.name}</span>
                  {c.kind === 'pickup' && <span className="chip">איסוף פיזי</span>}
                </label>
              ))}
            </div>
            {msg && <div className="badge b-green">{msg}</div>}
            {err && <div className="badge b-red">{err}</div>}
          </>
        )}
      </div>
    </div>
  )
}
