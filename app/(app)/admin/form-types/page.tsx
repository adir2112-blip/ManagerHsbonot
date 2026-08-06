'use client'
import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/client'

interface FormType { id: string; name: string; sort_order: number; active: boolean }

export default function FormTypesAdminPage() {
  const [items, setItems] = useState<FormType[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  function load() {
    apiGet<{ formTypes: FormType[] }>('/api/admin/form-types').then(d => setItems(d.formTypes))
  }
  useEffect(() => { load() }, [])

  async function addType(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiPost('/api/admin/form-types', { name: newName, sort_order: items.length })
      setNewName('')
      load()
    } catch (err: any) {
      setError(err.message || 'שגיאה')
    }
  }

  async function rename(id: string, name: string) {
    await apiPatch(`/api/admin/form-types/${id}`, { name })
    load()
  }

  async function toggleActive(id: string, active: boolean) {
    await apiPatch(`/api/admin/form-types/${id}`, { active })
    load()
  }

  return (
    <div>
      <div className="page-header"><div className="page-title">קטלוג טפסים</div></div>

      <form onSubmit={addType} className="card card-pad" style={{ marginBottom: 20, display: 'flex', gap: 10, maxWidth: 480 }}>
        <input className="form-input" placeholder="שם טופס חדש" value={newName} onChange={e => setNewName(e.target.value)} required />
        <button className="btn btn-primary btn-sm" type="submit">+ הוספה</button>
      </form>
      {error && <div className="badge b-red" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>שם</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {items.map(ft => (
                <tr key={ft.id}>
                  <td>
                    <input
                      className="form-input"
                      defaultValue={ft.name}
                      style={{ maxWidth: 260 }}
                      onBlur={e => e.target.value !== ft.name && rename(ft.id, e.target.value)}
                    />
                  </td>
                  <td>{ft.active ? <span className="badge b-green">פעיל</span> : <span className="badge b-gray">מושבת</span>}</td>
                  <td>
                    <button className="btn btn-xs" onClick={() => toggleActive(ft.id, !ft.active)}>
                      {ft.active ? 'השבתה' : 'הפעלה'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="td-muted">הקטלוג ריק — הוסיפו טופס ראשון למעלה</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
