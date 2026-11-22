'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { compressImage, formatBytes } from '@/lib/compress-image'

interface Category { id: string; name: string; icon: string; kind: 'upload' | 'pickup' }
interface Submission {
  id: string; category_id: string; kind: 'file' | 'none' | 'pickup'; file_name: string | null
  file_size: number | null; original_size: number | null; note: string | null; created_at: string
}
interface PeriodOpt { key: string; label: string }
interface Status { client: { name: string }; period: PeriodOpt; periods: PeriodOpt[]; categories: Category[]; submissions: Submission[] }
interface UploadJob { id: string; categoryId: string; name: string; stage: 'compress' | 'upload' | 'done' | 'error'; error?: string; saved?: number }

const BUCKET = 'client-docs'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error((data as any)?.error || 'שגיאה'), { status: res.status })
  return data as T
}

export default function PortalApp({ token, firstName, initiallyAuthed }: { token: string; firstName: string; initiallyAuthed: boolean }) {
  const [authed, setAuthed] = useState(initiallyAuthed)
  if (!authed) return <PortalLogin token={token} firstName={firstName} onSuccess={() => setAuthed(true)} />
  return <PortalHome token={token} onLoggedOut={() => setAuthed(false)} />
}

function PortalLogin({ token, firstName, onSuccess }: { token: string; firstName: string; onSuccess: () => void }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  async function submit(code: string) {
    setLoading(true)
    setError('')
    try {
      await call(`/api/portal/${token}/login`, { method: 'POST', body: JSON.stringify({ digits: code }) })
      onSuccess()
    } catch (e: any) {
      setError(e.message)
      setDigits(['', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { // pasted all 4 digits at once
      const arr = clean.slice(0, 4).split('')
      while (arr.length < 4) arr.push('')
      setDigits(arr)
      if (arr.every(Boolean)) submit(arr.join(''))
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 3) refs.current[i + 1]?.focus()
    if (next.every(Boolean)) submit(next.join(''))
  }

  return (
    <div className="portal-wrap">
      <div className="portal-login-card">
        <div className="portal-logo">📂</div>
        <div className="portal-h1">שלום {firstName} 👋</div>
        <div className="portal-sub">זהו האזור האישי שלך להעברת מסמכים למשרד הנהלת החשבונות.</div>
        <div className="portal-label">לאימות, הקלידו את <b>4 הספרות האחרונות</b> של תעודת הזהות</div>
        <div className="pin-row" dir="ltr">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              className="pin-box"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={i === 0 ? 4 : 1}
              value={d}
              autoFocus={i === 0}
              disabled={loading}
              onChange={e => setAt(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus() }}
            />
          ))}
        </div>
        {loading && <div className="portal-sub" style={{ marginTop: 14 }}>מאמת…</div>}
        {error && <div className="portal-error">{error}</div>}
        <div className="portal-secure">🔒 חיבור מאובטח · הקבצים נשמרים באחסון פרטי ומוצפן</div>
      </div>
    </div>
  )
}

function PortalHome({ token, onLoggedOut }: { token: string; onLoggedOut: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [periodKey, setPeriodKey] = useState<string | null>(null)
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [error, setError] = useState('')
  const supabase = useRef(createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }))

  const load = useCallback(async (key?: string | null) => {
    try {
      const s = await call<Status>(`/api/portal/${token}/status${key ? `?period=${key}` : ''}`)
      setStatus(s)
      setPeriodKey(s.period.key)
    } catch (e: any) {
      if (e.status === 401) onLoggedOut()
      else setError(e.message)
    }
  }, [token, onLoggedOut])

  useEffect(() => { load(null) }, [load])

  async function uploadFiles(cat: Category, files: FileList) {
    if (!periodKey) return
    const list = Array.from(files)
    for (const original of list) {
      const jobId = Math.random().toString(36).slice(2)
      const patch = (p: Partial<UploadJob>) => setJobs(js => js.map(j => j.id === jobId ? { ...j, ...p } : j))
      setJobs(js => [...js, { id: jobId, categoryId: cat.id, name: original.name, stage: 'compress' }])
      try {
        const file = await compressImage(original)
        if (file.size > 15 * 1024 * 1024) throw new Error('הקובץ גדול מ-15MB. נסו לצלם מחדש או לפצל את הקובץ.')
        patch({ stage: 'upload', saved: original.size > file.size ? original.size - file.size : 0 })
        const mime = file.type || 'application/octet-stream'
        const { path, token: uploadToken } = await call<{ path: string; token: string }>(`/api/portal/${token}/upload-url`, {
          method: 'POST', body: JSON.stringify({ period: periodKey, category_id: cat.id, file_name: file.name, size: file.size, mime }),
        })
        const { error: upErr } = await supabase.current.storage.from(BUCKET).uploadToSignedUrl(path, uploadToken, file, { contentType: mime })
        if (upErr) throw new Error('ההעלאה נכשלה, נסו שוב')
        await call(`/api/portal/${token}/submissions`, {
          method: 'POST',
          body: JSON.stringify({ kind: 'file', period: periodKey, category_id: cat.id, path, file_name: original.name.replace(/\.[^.]+$/, '') + '.' + (file.name.split('.').pop() || ''), size: file.size, original_size: original.size, mime }),
        })
        patch({ stage: 'done' })
      } catch (e: any) {
        if (e.status === 401) { onLoggedOut(); return }
        patch({ stage: 'error', error: e.message })
      }
    }
    await load(periodKey)
    setTimeout(() => setJobs(js => js.filter(j => j.stage !== 'done')), 4000)
  }

  async function mark(cat: Category, kind: 'none' | 'pickup', note?: string) {
    try {
      await call(`/api/portal/${token}/submissions`, { method: 'POST', body: JSON.stringify({ kind, period: periodKey, category_id: cat.id, note }) })
      await load(periodKey)
    } catch (e: any) { setError(e.message) }
  }

  async function remove(id: string) {
    try {
      await call(`/api/portal/${token}/submissions/${id}`, { method: 'DELETE' })
      await load(periodKey)
    } catch (e: any) { setError(e.message) }
  }

  async function logout() {
    await call(`/api/portal/${token}/logout`, { method: 'POST' }).catch(() => {})
    onLoggedOut()
  }

  if (!status) return <div className="portal-wrap"><div className="portal-sub" style={{ color: '#fff' }}>טוען…</div></div>

  const doneCount = status.categories.filter(c => status.submissions.some(s => s.category_id === c.id)).length
  const total = status.categories.length
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div>
          <div className="portal-header-title">📂 העברת מסמכים למשרד</div>
          <div className="portal-header-sub">{status.client.name}</div>
        </div>
        <button className="portal-logout" onClick={logout}>יציאה</button>
      </header>

      <main className="portal-main">
        <section className="portal-period-card">
          <div className="portal-period-row">
            <div>
              <div className="portal-period-lbl">תקופת דיווח מע״מ</div>
              <div className="portal-period-val">{status.period.label}</div>
            </div>
            {status.periods.length > 1 && (
              <select className="portal-select" value={periodKey || ''} onChange={e => load(e.target.value)}>
                {status.periods.map((p, i) => <option key={p.key} value={p.key}>{p.label}{i === 0 ? ' (נוכחית)' : ''}</option>)}
              </select>
            )}
          </div>
          <div className="portal-progress"><div className="portal-progress-bar" style={{ width: `${pct}%` }} /></div>
          <div className="portal-progress-txt">
            {doneCount === total && total > 0 ? '🎉 מעולה! כל המסמכים לתקופה זו הועברו' : `הושלמו ${doneCount} מתוך ${total} קטגוריות`}
          </div>
        </section>

        {error && <div className="portal-error" onClick={() => setError('')}>{error}</div>}

        {status.categories.map(cat => {
          const subs = status.submissions.filter(s => s.category_id === cat.id)
          const files = subs.filter(s => s.kind === 'file')
          const marks = subs.filter(s => s.kind !== 'file')
          const done = subs.length > 0
          const catJobs = jobs.filter(j => j.categoryId === cat.id)
          return (
            <section key={cat.id} className={`portal-cat ${done ? 'done' : ''}`}>
              <div className="portal-cat-head">
                <div className="portal-cat-icon">{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="portal-cat-name">{cat.name}</div>
                  <div className={`portal-cat-status ${done ? 'ok' : ''}`}>
                    {done ? `✓ עודכן ${fmtDate(subs[0].created_at)}` : 'טרם הועבר'}
                  </div>
                </div>
                {done ? <div className="portal-check">✓</div> : <div className="portal-x">✕</div>}
              </div>

              {files.length > 0 && (
                <ul className="portal-files">
                  {files.map(f => (
                    <li key={f.id}>
                      <span className="portal-file-name">📎 {f.file_name}</span>
                      <span className="portal-file-meta">{formatBytes(f.file_size)}</span>
                      <button className="portal-del" onClick={() => remove(f.id)} aria-label="מחיקה">🗑</button>
                    </li>
                  ))}
                </ul>
              )}
              {marks.map(m => (
                <div key={m.id} className="portal-mark">
                  {m.kind === 'pickup' ? '📦 סומן: המסמכים מוכנים לאיסוף' : '🚫 סומן: אין מסמכים בתקופה זו'}
                  {m.note && <span> — {m.note}</span>}
                  <button className="portal-del" onClick={() => remove(m.id)} aria-label="ביטול">✕</button>
                </div>
              ))}

              {catJobs.map(j => (
                <div key={j.id} className={`portal-job ${j.stage}`}>
                  {j.stage === 'compress' && '⚙️ מכין ומקטין את הקובץ…'}
                  {j.stage === 'upload' && `⬆️ מעלה… ${j.saved ? `(הוקטן ב-${formatBytes(j.saved)})` : ''}`}
                  {j.stage === 'done' && `✅ ${j.name} הועלה בהצלחה`}
                  {j.stage === 'error' && `⚠️ ${j.name}: ${j.error}`}
                </div>
              ))}

              {cat.kind === 'upload' ? (
                <div className="portal-actions">
                  <label className="portal-btn primary">
                    📷 צילום / בחירת קבצים
                    <input type="file" multiple accept="image/*,application/pdf,.xlsx,.xls,.csv,.docx" hidden
                      onChange={e => { if (e.target.files?.length) uploadFiles(cat, e.target.files); e.target.value = '' }} />
                  </label>
                  {!done && <button className="portal-btn ghost" onClick={() => mark(cat, 'none')}>אין מסמכים בתקופה זו</button>}
                </div>
              ) : (
                !done && (
                  <div className="portal-actions">
                    <button className="portal-btn primary" onClick={() => mark(cat, 'pickup')}>📦 המסמכים מוכנים לאיסוף</button>
                    <button className="portal-btn ghost" onClick={() => mark(cat, 'none')}>אין מסמכים לאיסוף</button>
                  </div>
                )
              )}
            </section>
          )
        })}

        {status.categories.length === 0 && <div className="portal-cat"><div className="portal-sub">לא הוגדרו קטגוריות. פנו למשרד.</div></div>}

        <div className="portal-secure" style={{ color: 'rgba(255,255,255,0.7)' }}>🔒 תמונות מוקטנות אוטומטית לפני ההעלאה · אחסון פרטי ומאובטח</div>
      </main>
    </div>
  )
}
