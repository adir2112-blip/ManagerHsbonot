'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiGet } from '@/lib/client'
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from '@/lib/nav-items'

interface TopbarProps {
  fullName: string
  role: 'admin' | 'bookkeeper'
}

interface ClientStatus { relevant: boolean; complete: boolean; checkedCount: number; total: number; isBehind: boolean; daysBehind: number }
interface ClientResult { id: string; name: string; phone: string | null; status: ClientStatus }

function StatusBadge({ status }: { status: ClientStatus }) {
  if (!status.relevant) return <span style={{ fontSize: 11, color: '#9ca3af' }}>לא רלוונטי החודש</span>
  if (status.isBehind) return <span className="badge b-red">בחריגה {status.daysBehind} ימים</span>
  if (status.complete) return <span className="badge b-green">✓ הושלם</span>
  return <span className="badge b-amber">{status.checkedCount}/{status.total}</span>
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

        <div className="user-pill">
          <div className="avatar">{initials}</div>
          <div>
            <div className="user-name">{fullName}</div>
            <div className="user-role">{role === 'admin' ? 'מנהל ראשי' : 'הנהלת חשבונות'}</div>
          </div>
        </div>
        <button className="btn btn-white btn-sm" onClick={handleLogout}>יציאה</button>
      </div>
    </div>
  )
}
