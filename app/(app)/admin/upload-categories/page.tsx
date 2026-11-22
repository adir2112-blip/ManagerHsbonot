'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/client'

interface Category { id: string; name: string; icon: string; kind: 'upload' | 'pickup'; sort_order: number; active: boolean }

export default function UploadCategoriesAdminPage() {
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📄')
  const [kind, setKind] = useState<'upload' | 'pickup'>('upload')
  const [error, setError] = useState('')

  function load() { apiGet<{ categories: Category[] }>('/api/admin/upload-categories').then(d => setItems(d.categories)) }
  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiPost('/api/admin/upload-categories', { name, icon, kind, sort_order: items.length })
      setName(''); setIcon('📄'); setKind('upload'); load()
    } catch (err: any) { setError(err.message) }
  }

  async function patch(id: string, body: Partial<Category>) { await apiPatch(`/api/admin/upload-categories/${id}`, body); load() }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📤 קטגוריות מסמכים לפורטל הלקוח</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>הקטגוריות שהלקוח רואה בקישור האישי. את הבחירה לכל לקוח עושים מכרטיס הלקוח ← "פורטל מסמכים".</div>
        </div>
      </div>

      <form onSubmit={add} className="card card-pad" style={{ marginBottom: 20, display: 'flex', gap: 10, maxWidth: 640, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ width: 70, textAlign: 'center' }} value={icon} onChange={e => setIcon(e.target.value)} title="אייקון" />
        <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="שם קטגוריה (למשל: חשבוניות ספקים)" value={name} onChange={e => setName(e.target.value)} required />
        <select className="form-input" style={{ width: 150 }} value={kind} onChange={e => setKind(e.target.value as any)}>
          <option value="upload">העלאת קבצים</option>
          <option value="pickup">איסוף פיזי</option>
        </select>
        <button className="btn btn-primary btn-sm" type="submit">+ הוספה</button>
      </form>
      {error && <div className="badge b-red" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>אייקון</th><th>שם</th><th>סוג</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id}>
                  <td><input className="form-input" defaultValue={c.icon} style={{ width: 60, textAlign: 'center' }} onBlur={e => e.target.value !== c.icon && patch(c.id, { icon: e.target.value })} /></td>
                  <td><input className="form-input" defaultValue={c.name} style={{ maxWidth: 260 }} onBlur={e => e.target.value !== c.name && patch(c.id, { name: e.target.value })} /></td>
                  <td>
                    <select className="form-input" value={c.kind} style={{ width: 140 }} onChange={e => patch(c.id, { kind: e.target.value as any })}>
                      <option value="upload">העלאת קבצים</option>
                      <option value="pickup">איסוף פיזי</option>
                    </select>
                  </td>
                  <td>{c.active ? <span className="badge b-green">פעיל</span> : <span className="badge b-gray">מושבת</span>}</td>
                  <td><button className="btn btn-xs" onClick={() => patch(c.id, { active: !c.active })}>{c.active ? 'השבתה' : 'הפעלה'}</button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="td-muted">אין קטגוריות</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
