'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiGet, apiPatch } from '@/lib/client'
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from '@/lib/nav-items'

interface TopbarProps {
  fullName: string
  role: 'admin' | 'bookkeeper'
}

interface ClientStatus { relevant: boolean; complete: boolean; checkedCount: number; total: number; isBehind: boolean; daysBehind: number }
interface ClientResult { id: string; name: string; phone: string | null; status: ClientStatus }
interface DueReminder {
  id: string; remind_at: string; note: string | null
  client: { id: string; name: string } | null
  form_type: { id: string; name: string } | null
}

function StatusBadge({ status }: { status: ClientStatus }) {
  if (!status.relevant) return <span style={{ fontSize: 11, color: '#9ca3af' }}>לא רלוונטי החודש</span>
  if (status.isBehind) return <span className="badge b-red">בחריגה {status.daysBehind} ימים</span>
  if (status.complete) return <span className="badge b-green">✓ הושלם</span>
  return <span className="badge b-amber">{status.checkedCount}/{status.total}</span>
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export default function Topbar({ fullName, role }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = fullName.split(' ').map(p => p[0]).join('').slice(0, 2)

  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState<ClientResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dueReminders, setDueReminders] = useState<DueReminder[]>([])
  const [showReminderPopup, setShowReminderPopup] = useState(false)
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null)
  const [rescheduleValue, setRescheduleValue] = useState('')

  useEffect(() => {
    function checkDue() {
      apiGet<{ reminders: DueReminder[] }>('/api/reminders?due=1')
        .then(d => {
          setDueReminders(d.reminders || [])
          if ((d.reminders || []).length > 0) setShowReminderPopup(true)
        })
        .catch(() => {})
    }
    checkDue()
    const t = setInterval(checkDue, 60_000) // poll every minute — good enough for a reminder, not a real-time chat
    return () => clearInterval(t)
  }, [])

  // "✓ טופל" — the reminder was about going to actually complete the task, so it sends the
  // employee straight to the client card to mark it there, not just dismiss the popup.
  async function handleDoneAndGoToClient(r: DueReminder) {
    try { await apiPatch(`/api/reminders/${r.id}`, { is_done: true }) } catch {}
    setDueReminders(prev => prev.filter(x => x.id !== r.id))
    setShowReminderPopup(false)
    if (r.client) router.push(`/clients/${r.client.id}`)
  }

  async function cancelReminder(id: string) {
    try { await apiPatch(`/api/reminders/${id}`, { is_done: true }) } catch {}
    setDueReminders(prev => prev.filter(r => r.id !== id))
    setRescheduleFor(null)
  }

  async function rescheduleReminder(id: string) {
    if (!rescheduleValue) return
    try { await apiPatch(`/api/reminders/${id}`, { remind_at: new Date(rescheduleValue).toISOString() }) } catch {}
    setDueReminders(prev => prev.filter(r => r.id !== id))
    setRescheduleFor(null)
    setRescheduleValue('')
  }

  function doSearch(q: string) {
    setSearchQ(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setResults([]); setShowResults(false); return }
    setShowResults(true)
    searchTimer.current = setTimeout(() => {
      apiGet<{ clients: ClientResult[] }>(`/api/clients?q=${encodeURIComponent(q.trim())}`)
        .then(d => setResults(d.clients || []))
        .catch(() => setResults([]))
    }, 300)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectResult(id: string) {
    setShowResults(false)
    setSearchQ('')
    router.push(`/clients/${id}`)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <span className="brand-dot" />
        <span>מעקב טפסים חודשי</span>
      </div>
      <div className="topbar-nav">
        {NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} className={`nav-btn${pathname === item.href ? ' active' : ''}`}>
            {item.label}
          </Link>
        ))}
        {role === 'admin' && ADMIN_NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} className={`nav-btn${pathname === item.href ? ' active' : ''}`}>
            {item.label}
          </Link>
        ))}
        <Link href="/clients/new" style={{
          display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff',
          fontWeight: 700, fontSize: 13, textDecoration: 'none', fontFamily: 'Heebo,sans-serif',
          boxShadow: '0 2px 8px rgba(5,150,105,0.35)', border: 'none', gap: 4, flexShrink: 0, whiteSpace: 'nowrap',
        }}>＋ לקוח חדש</Link>
      </div>
      <div className="topbar-right">
        <div ref={searchRef} style={{ position: 'relative' }}>
          <input
            value={searchQ}
            onChange={e => doSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="🔍 חיפוש לקוח לפי שם/טלפון..."
            style={{ width: 220, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontFamily: 'Heebo,sans-serif', outline: 'none' }}
          />
          <style>{`.topbar input::placeholder { color: rgba(255,255,255,0.7) !important; }`}</style>
          {showResults && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #dde1eb', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 999, overflow: 'hidden', minWidth: 260, maxHeight: 320, overflowY: 'auto' }}>
              {results.map(c => (
                <div
                  key={c.id}
                  onClick={() => selectResult(c.id)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f3f8' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eff4ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.name}</span>
                    {c.phone && <span style={{ fontSize: 11, color: '#6b7280', direction: 'ltr' }}>{c.phone}</span>}
                  </div>
                  <div style={{ marginTop: 4 }}><StatusBadge status={c.status} /></div>
                </div>
              ))}
              {results.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>לא נמצאו לקוחות</div>}
            </div>
          )}
        </div>

        {dueReminders.length > 0 && (
          <button onClick={() => setShowReminderPopup(true)} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#b91c1c', fontFamily: 'Heebo,sans-serif' }}>
            🔔 {dueReminders.length}
          </button>
        )}

        <div className="user-pill">
          <div className="avatar">{initials}</div>
          <div>
            <div className="user-name">{fullName}</div>
            <div className="user-role">{role === 'admin' ? 'מנהל ראשי' : 'הנהלת חשבונות'}</div>
          </div>
        </div>
        <button className="btn btn-white btn-sm" onClick={handleLogout}>יציאה</button>
      </div>

      {showReminderPopup && dueReminders.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowReminderPopup(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔔 תזכורות שממתינות לך</div>
              <span style={{ marginRight: 'auto', fontSize: 12, color: '#9ca3af' }}>{dueReminders.length} תזכורות</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {dueReminders.map(r => (
                <div key={r.id} style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{r.client?.name || 'לקוח'}{r.form_type ? ` — ${r.form_type.name}` : ''}</span>
                    <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>{fmtDateTime(r.remind_at)}</span>
                  </div>
                  {r.note && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{r.note}</div>}

                  {rescheduleFor !== r.id && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-xs" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }} onClick={() => handleDoneAndGoToClient(r)}>✓ טופל</button>
                      <button className="btn btn-xs" onClick={() => { setRescheduleFor(r.id); setRescheduleValue('') }}>✗ לא טופל</button>
                    </div>
                  )}

                  {rescheduleFor === r.id && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #fca5a5' }}>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">לתזמן להתראה חדשה?</label>
                        <input className="form-input" type="datetime-local" value={rescheduleValue} onChange={e => setRescheduleValue(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-xs btn-primary" disabled={!rescheduleValue} onClick={() => rescheduleReminder(r.id)}>תזמון מחדש</button>
                        <button className="btn btn-xs btn-danger" onClick={() => cancelReminder(r.id)}>ביטול התזכורת</button>
                        <button className="btn btn-xs" onClick={() => setRescheduleFor(null)}>חזרה</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => setShowReminderPopup(false)}>סגור</button>
          </div>
        </div>
      )}
    </div>
  )
}
