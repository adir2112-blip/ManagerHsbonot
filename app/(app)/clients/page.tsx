import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/server'
import { isMonthRelevant, computeMonthStatus, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const ctx = await getCurrentUser()
  if (!ctx) return null
  const { supabase } = ctx

  const today = israelToday()
  const { data: clients } = await supabase.from('clients').select('*, assigned_employee:assigned_employee_id(id, full_name)').eq('active', true).order('name')
  const clientIds = (clients || []).map(c => c.id)

  const [{ data: formTypes }, { data: items }, formTypeMap] = await Promise.all([
    supabase.from('form_types').select('*'),
    supabase.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    fetchClientFormTypeMap(supabase, clientIds),
  ])

  return (
    <div>
      <div className="page-header">
        <div className="page-title">לקוחות</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/api/clients/export" className="btn btn-sm">📊 ייצוא לאקסל</a>
          <Link href="/clients/new" className="btn btn-primary">+ לקוח חדש</Link>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>שם</th><th>טלפון</th><th>מחזוריות</th><th>עובדת אחראית</th><th>סטטוס החודש</th></tr></thead>
            <tbody>
              {(clients || []).map(c => {
                const relevantThisMonth = isMonthRelevant(c.cycle, c.cycle_start_date, today.year, today.month)
                const selectedIds = formTypeMap.get(c.id) || new Set()
                const clientFormTypes = (formTypes || []).filter(ft => selectedIds.has(ft.id))
                const clientItems = (items || []).filter(i => i.client_id === c.id)
                const status = relevantThisMonth ? computeMonthStatus(clientFormTypes, clientItems, today.year, today.month) : null
                return (
                  <tr key={c.id}>
                    <td><Link href={`/clients/${c.id}`}>{c.name}</Link></td>
                    <td className="td-mono">{c.phone || '—'}</td>
                    <td><span className="chip">{c.cycle === 'monthly' ? 'חודשי' : 'דו-חודשי'}</span></td>
                    <td>{c.assigned_employee?.full_name || '—'}</td>
                    <td>
                      {!relevantThisMonth && <span className="td-muted">—</span>}
                      {relevantThisMonth && status?.complete && <span className="badge b-green">✓ הושלם</span>}
                      {relevantThisMonth && status && !status.complete && <span className="badge b-amber">{status.checkedCount}/{status.total}</span>}
                    </td>
                  </tr>
                )
              })}
              {(clients || []).length === 0 && <tr><td colSpan={5} className="td-muted">אין עדיין לקוחות</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
