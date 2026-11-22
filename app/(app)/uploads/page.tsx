'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/client'
import { formatBytes } from '@/lib/compress-image'
import ClientPortalPanel from '@/components/ClientPortalPanel'

interface Category { id: string; name: string; icon: string; kind: 'upload' | 'pickup' }
interface Submission {
  id: string; client_id: string; category_id: string; kind: 'file' | 'none' | 'pickup'
  file_name: string | null; file_size: number | null; mime_type: string | null; note: string | null; created_at: string
}
interface Row {
  id: string; name: string; phone: string | null; portal_token: string; portal_enabled: boolean; has_id_number: boolean
  assigned_employee: { id: string; full_name: string } | null
  categoryIds: string[]; submissions: Submission[]
}
interface Data { period: { key: string; label: string; isCurrent: boolean }; periods: { key: string; label: string }[]; categories: Category[]; rows: Row[] }
type Filter = 'all' | 'complete' | 'partial' | 'none'

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit' })
}
function fmtFull(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
}
function portalUrl(token: string) {
  return typeof window === 'undefined' ? `/portal/${token}` : `${window.location.origin}/portal/${token}`
}
function whatsappPortalLink(phone: string, name: string, token: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '')
  const intl = digits.startsWith('972') ? digits : `972${digits}`
  const msg = `שלום ${name.split(' ')[0]} 👋\nזה הקישור האישי שלך להעברת מסמכים למשרד (חשבוניות, הוצאות ועוד):\n${portalUrl(token)}\nלכניסה יש להקליד את 4 הספרות האחרונות של תעודת הזהות.\nתודה!`
  return `https://web.whatsapp.com/send?phone=${intl}&text=${encodeURIComponent(msg)}`
}

function rowState(r: Row): 'complete' | 'partial' | 'none' | 'na' {
  if (r.categoryIds.length === 0) return 'na'
  const done = r.categoryIds.filter(id => r.submissions.some(s => s.category_id === id)).length
  return done === r.categoryIds.length ? 'complete' : done > 0 ? 'partial' : 'none'
}

export default function UploadsDashboardPage() {
  const [data, setData] = useState<Data | null>(null)
  const [periodKey, setPeriodKey] = useState<string>('')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<{ row: Row; categoryId?: string } | null>(null)
  const [portalFor, setPortalFor] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback((key?: string) => {
    apiGet<Data>(`/api/uploads${key ? `?period=${key}` : ''}`).then(d => { setData(d); setPeriodKey(d.period.key) })
  }, [])
  useEffect(() => { load() }, [load])
  // Live-ish: refresh every 30s on the current period so new uploads pop in during the day.
  useEffect(() => {
    if (!data?.period.isCurrent) return
    const t = setInterval(() => load(periodKey), 30_000)
    return () => clearInterval(t)
  }, [data?.period.isCurrent, periodKey, load])

  const stats = useMemo(() => {
    const rows = (data?.rows || []).filter(r => r.categoryIds.length > 0)
    const st = rows.map(rowState)
    return {
      total: rows.length,
      complete: st.filter(s => s === 'complete').length,
      partial: st.filter(s => s === 'partial').length,
      none: st.filter(s => s === 'none').length,
      files: (data?.rows || []).reduce((n, r) => n + r.submissions.filter(s => s.kind === 'file').length, 0),
    }
  }, [data])

  if (!data) return <div className="td-muted">טוען…</div>

  const visibleCats = data.categories.filter(c => data.rows.some(r => r.categoryIds.includes(c.id)))
  const rows = data.rows
    .filter(r => r.categoryIds.length > 0)
    .filter(r => filter === 'all' || rowState(r) === filter)
    .filter(r => !q.trim() || r.name.includes(q.trim()) || (r.phone || '').includes(q.trim()))

  function copyLink(r: Row) {
    navigator.clipboard.writeText(portalUrl(r.portal_token)).then(() => { setToast(`הקישור של ${r.name} הועתק`); setTimeout(() => setToast(''), 2200) })
  }

  const idx = data.periods.findIndex(p => p.key === periodKey)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📤 מרכז מסמכים מלקוחות</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            תקופת מע״מ: <b>{data.period.label}</b>{' '}
            {data.period.isCurrent ? <span className="badge b-blue">תקופה נוכחית</span> : <span className="badge b-gray">תקופה קודמת</span>}
          </div>
        </div>
        <div className="up-period-nav">
          <button className="btn btn-sm" disabled={idx >= data.periods.length - 1} onClick={() => load(data.periods[idx + 1].key)}>→ קודמת</button>
          <select className="form-input" style={{ width: 200 }} value={periodKey} onChange={e => load(e.target.value)}>
            {data.periods.map((p, i) => <option key={p.key} value={p.key}>{p.label}{i === 0 ? ' (נוכחית)' : ''}</option>)}
          </select>
          <button className="btn btn-sm" disabled={idx <= 0} onClick={() => load(data.periods[idx - 1].key)}>הבאה ←</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat-card clickable" onClick={() => setFilter('all')} style={filter === 'all' ? { borderColor: 'var(--accent)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}>👥</div>
          <div className="stat-num" style={{ color: 'var(--accent)' }}>{stats.total}</div>
          <div className="stat-lbl">לקוחות בפורטל</div>
        </div>
        <div className="stat-card clickable" onClick={() => setFilter('complete')} style={filter === 'complete' ? { borderColor: 'var(--green)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--green-lt)', color: 'var(--green)' }}>✓</div>
          <div className="stat-num" style={{ color: 'var(--green)' }}>{stats.complete}</div>
          <div className="stat-lbl">העבירו הכל</div>
        </div>
        <div className="stat-card clickable" onClick={() => setFilter('partial')} style={filter === 'partial' ? { borderColor: 'var(--amber)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--amber-lt)', color: 'var(--amber)' }}>◐</div>
          <div className="stat-num" style={{ color: 'var(--amber)' }}>{stats.partial}</div>
          <div className="stat-lbl">העבירו חלקית</div>
        </div>
        <div className="stat-card clickable" onClick={() => setFilter('none')} style={filter === 'none' ? { borderColor: 'var(--red)' } : undefined}>
          <div className="stat-icon" style={{ background: 'var(--red-lt)', color: 'var(--red)' }}>✕</div>
          <div className="stat-num" style={{ color: 'var(--red)' }}>{stats.none}</div>
          <div className="stat-lbl">לא העבירו</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--purple-lt)', color: 'var(--purple)' }}>📎</div>
          <div className="stat-num" style={{ color: 'var(--purple)' }}>{stats.files}</div>
          <div className="stat-lbl">קבצים בתקופה</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            {filter === 'all' ? 'כל הלקוחות' : filter === 'complete' ? 'העבירו הכל' : filter === 'partial' ? 'העבירו חלקית' : 'לא העבירו'} ({rows.length})
          </div>
          <input className="form-input" placeholder="חיפוש לקוח…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 220 }} />
        </div>
        <div className="table-wrap">
          <table className="up-table">
            <thead>
              <tr>
                <th>לקוח</th>
                {visibleCats.map(c => <th key={c.id} className="up-col">{c.icon} {c.name}</th>)}
                <th>קישור אישי</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/clients/${r.id}`} style={{ fontWeight: 600 }}>{r.name}</Link>
                    <div className="td-muted">{r.assigned_employee?.full_name || 'ללא שיוך'}</div>
                  </td>
                  {visibleCats.map(c => {
                    if (!r.categoryIds.includes(c.id)) return <td key={c.id} className="up-col"><span className="up-na" title="לא רלוונטי ללקוח">—</span></td>
                    const subs = r.submissions.filter(s => s.category_id === c.id)
                    if (subs.length === 0) return (
                      <td key={c.id} className="up-col"><span className="up-cell" title="טרם הועבר"><span className="up-x">✕</span></span></td>
                    )
                    const files = subs.filter(s => s.kind === 'file').length
                    const last = subs[0]
                    return (
                      <td key={c.id} className="up-col">
                        <span className="up-cell" onClick={() => setDetail({ row: r, categoryId: c.id })} title={`עודכן ${fmtFull(last.created_at)}`}>
                          <span className="up-v">✓</span>
                          <span className="up-date">{fmtShort(last.created_at)}</span>
                          <span className="up-count">
                            {files > 0 ? `${files} קבצים` : last.kind === 'pickup' ? 'מוכן לאיסוף' : 'אין מסמכים'}
                          </span>
                        </span>
                      </td>
                    )
                  })}
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      {!r.has_id_number ? (
                        <button className="btn btn-xs" style={{ color: 'var(--amber)' }} onClick={() => setPortalFor(r.id)}>⚠ הגדר ת.ז.</button>
                      ) : (
                        <>
                          <button className="btn btn-xs" onClick={() => copyLink(r)} title="העתקת קישור">🔗</button>
                          {r.phone && <a className="btn btn-xs" href={whatsappPortalLink(r.phone, r.name, r.portal_token)} target="_blank" rel="noreferrer" title="שליחה בוואטסאפ">💬</a>}
                          <button className="btn btn-xs" onClick={() => setPortalFor(r.id)} title="הגדרות פורטל">⚙</button>
                        </>
                      )}
                      <button className="btn btn-xs" onClick={() => setDetail({ row: r })}>📂 קבצים</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={visibleCats.length + 2} className="td-muted">אין לקוחות להצגה</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <FilesModal row={detail.row} categories={data.categories} focusCategory={detail.categoryId} periodLabel={data.period.label} onClose={() => setDetail(null)} />
      )}
      {portalFor && (
        <ClientPortalPanel clientId={portalFor} onClose={() => setPortalFor(null)} onChanged={() => load(periodKey)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function FilesModal({ row, categories, focusCategory, periodLabel, onClose }: {
  row: Row; categories: Category[]; focusCategory?: string; periodLabel: string; onClose: () => void
}) {
  const cats = categories.filter(c => row.categoryIds.includes(c.id) && (!focusCategory || c.id === focusCategory))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📂 {row.name} — {periodLabel}</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {cats.map(c => {
          const subs = row.submissions.filter(s => s.category_id === c.id)
          return (
            <div key={c.id} className="cat-block">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b>{c.icon} {c.name}</b>
                {subs.length > 0 ? <span className="badge b-green">✓ עודכן {fmtFull(subs[0].created_at)}</span> : <span className="badge b-red">✕ טרם הועבר</span>}
              </div>
              {subs.map(s => (
                <div key={s.id} className="up-file-row">
                  {s.kind === 'file' ? (
                    <>
                      <span>{s.mime_type?.startsWith('image/') ? '🖼️' : s.mime_type === 'application/pdf' ? '📕' : '📄'}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.file_name}</span>
                      <span className="td-muted">{formatBytes(s.file_size)} · {fmtFull(s.created_at)}</span>
                      <a className="btn btn-xs" href={`/api/uploads/file/${s.id}`} target="_blank" rel="noreferrer">👁 צפייה</a>
                      <a className="btn btn-xs" href={`/api/uploads/file/${s.id}?download=1`}>⬇ הורדה</a>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text2)' }}>
                      {s.kind === 'pickup' ? '📦 הלקוח סימן שהמסמכים מוכנים לאיסוף' : '🚫 הלקוח סימן: אין מסמכים בתקופה זו'}
                      {s.note && ` — ${s.note}`} <span className="td-muted">({fmtFull(s.created_at)})</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
        {focusCategory && <div className="td-muted" style={{ textAlign: 'center' }}>מוצגת קטגוריה אחת — סגרו ולחצו "📂 קבצים" לכל הקטגוריות</div>}
      </div>
    </div>
  )
}
