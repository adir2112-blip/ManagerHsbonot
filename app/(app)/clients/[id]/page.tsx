'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiGet, apiPatch, apiDelete, apiPost } from '@/lib/client'
import ChecklistMonth from '@/components/ChecklistMonth'
import ClientFormTypesPanel from '@/components/ClientFormTypesPanel'

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

interface Employee { id: string; full_name: string }
interface Client {
  id: string; name: string; phone: string | null; email: string | null; cycle: 'monthly' | 'bimonthly'; cycle_start_date: string
  assigned_employee_id: string | null; assigned_employee: Employee | null; notes: string | null; active: boolean
}
interface HistoryRow { year: number; month: number; total: number; checkedCount: number; complete: boolean }
interface Reliability { totalMonths: number; lateMonths: number }
interface EmailEvent {
  id: string; sent_at: string | null; status: 'sent' | 'failed' | 'skipped'
  error_message: string | null; stage_days_overdue: number | null; year: number; month: number
}

function fmtSentAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

// Hebrew has a distinct dual form for "two" (שני דיווחים vs 3+ דיווחים), so 1/2/3+ each get
// their own phrasing rather than a generic "X reports" that would read oddly for 1–2.
function remainingText(remaining: number, complete: boolean): string {
  if (remaining === 0 && !complete) return '⏳ כל הטפסים הוגשו, אבל יש עדיין "המשך טיפול" פתוח החודש'
  if (remaining === 0) return '🎉 כל הטפסים הוגשו החודש ללקוח הזה!'
  if (remaining === 1) return '💪 נשאר עוד דיווח אחד לטיפול סופי בלקוח החודש'
  if (remaining === 2) return '💪 נשארו עוד שני דיווחים לטיפול סופי בלקוח החודש'
  return `💪 נשארו עוד ${remaining} דיווחים לטיפול סופי בלקוח החודש`
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [emailHistory, setEmailHistory] = useState<EmailEvent[]>([])
  const [reliability, setReliability] = useState<Reliability | null>(null)
  const [today, setToday] = useState<{ year: number; month: number } | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [sendReminderError, setSendReminderError] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [showFormTypes, setShowFormTypes] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCycleStart, setEditCycleStart] = useState('')
  const [editAssignee, setEditAssignee] = useState('')

  const load = useCallback(() => {
    apiGet<{ client: Client; history: HistoryRow[]; today: { year: number; month: number }; emailHistory: EmailEvent[]; reliability: Reliability }>(`/api/clients/${params.id}`).then(d => {
      setClient(d.client)
      setHistory(d.history)
      setToday(d.today)
      setEmailHistory(d.emailHistory)
      setReliability(d.reliability)
      setEditPhone(d.client.phone || '')
      setEditEmail(d.client.email || '')
      setEditCycleStart(d.client.cycle_start_date)
      setEditAssignee(d.client.assigned_employee_id || '')
      if (!expanded && d.history.length > 0) setExpanded(`${d.history[0].year}-${d.history[0].month}`)
    })
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiGet<{ employees: Employee[] }>('/api/employees').then(d => setEmployees(d.employees))
    load()
  }, [load])

  async function saveEdit() {
    await apiPatch(`/api/clients/${params.id}`, {
      phone: editPhone || null, email: editEmail || null,
      cycle_start_date: editCycleStart, assigned_employee_id: editAssignee || null,
    })
    setEditing(false)
    load()
  }

  async function handleSendReminder() {
    setSendingReminder(true)
    setSendReminderError('')
    try {
      await apiPost(`/api/clients/${params.id}/send-reminder`)
      load()
    } catch (err: any) {
      setSendReminderError(err.message || 'שליחת המייל נכשלה')
    } finally {
      setSendingReminder(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await apiDelete(`/api/clients/${params.id}`)
      router.push('/clients')
    } finally {
      setDeleting(false)
    }
  }

  if (!client) return <div className="td-muted">טוען…</div>

  const currentMonthRow = today ? history.find(h => h.year === today.year && h.month === today.month) : undefined
  const remaining = currentMonthRow ? currentMonthRow.total - currentMonthRow.checkedCount : null

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{client.name}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip">{client.cycle === 'monthly' ? 'חודשי' : 'דו-חודשי'}</span>
            <span className="chip">עובדת אחראית: {client.assigned_employee?.full_name || 'ללא שיוך'}</span>
            {client.phone && <span className="chip" style={{ direction: 'ltr' }}>{client.phone}</span>}
            {client.email && <span className="chip" style={{ direction: 'ltr' }}>{client.email}</span>}
            {reliability && reliability.totalMonths > 0 && (
              <span className={`badge ${reliability.lateMonths === 0 ? 'b-green' : reliability.lateMonths <= 2 ? 'b-amber' : 'b-red'}`}>
                {reliability.lateMonths === 0
                  ? `✓ תמיד בזמן (${reliability.totalMonths} חודשים אחרונים)`
                  : `איחר/ה ב-${reliability.lateMonths} מתוך ${reliability.totalMonths} החודשים האחרונים`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={handleSendReminder} disabled={sendingReminder || !client.email} title={!client.email ? 'יש להגדיר קודם אימייל ללקוח' : undefined}>
            {sendingReminder ? 'שולח…' : '📧 שלח מייל תזכורת'}
          </button>
          <button className="btn btn-sm" onClick={() => setShowFormTypes(true)}>📋 טפסים ללקוח</button>
          <button className="btn btn-sm" onClick={() => setEditing(e => !e)}>{editing ? 'ביטול' : 'עריכה'}</button>
          <button className="btn btn-sm btn-danger" onClick={() => setShowDeleteConfirm(true)}>🗑 מחיקת לקוח</button>
        </div>
      </div>

      {sendReminderError && <div className="badge b-red" style={{ marginBottom: 14 }}>{sendReminderError}</div>}

      {editing && (
        <div className="card card-pad" style={{ marginBottom: 20, maxWidth: 480 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">טלפון</label>
              <input className="form-input" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} />
            </div>
            <div className="form-group">
              <label className="form-label">אימייל הלקוח</label>
              <input className="form-input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">תאריך הגשה ראשון (עוגן מחזוריות)</label>
              <input className="form-input" type="date" value={editCycleStart} onChange={e => setEditCycleStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">עובדת אחראית</label>
              <select className="form-input" value={editAssignee} onChange={e => setEditAssignee(e.target.value)}>
                <option value="">ללא שיוך</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>שמירה</button>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title">היסטוריה חודשית</div></div>
        <div>
          {history.map(h => {
            const key = `${h.year}-${h.month}`
            const isOpen = expanded === key
            return (
              <div key={key}>
                <div
                  onClick={() => setExpanded(isOpen ? null : key)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600 }}>{HEBREW_MONTHS[h.month - 1]} {h.year}</span>
                  <span>
                    {h.complete ? <span className="badge b-green">✓ הושלם</span> : <span className="badge b-amber">{h.checkedCount}/{h.total}</span>}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 18px 14px' }}>
                    <ChecklistMonth clientId={client.id} year={h.year} month={h.month} onChanged={load} />
                  </div>
                )}
              </div>
            )
          })}
          {history.length === 0 && <div className="td-muted" style={{ padding: 18 }}>אין עדיין חודשים רלוונטיים ללקוח זה</div>}
        </div>
      </div>

      {remaining !== null && currentMonthRow && (
        <div
          className="card card-pad"
          style={{
            marginTop: 20, textAlign: 'center', fontSize: 20, fontWeight: 800,
            color: currentMonthRow.complete ? 'var(--green)' : 'var(--amber)',
            background: currentMonthRow.complete ? 'var(--green-lt)' : 'var(--amber-lt)',
          }}
        >
          {remainingText(remaining, currentMonthRow.complete)}
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><div className="card-title">📧 היסטוריית מיילי תזכורת</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>נשלח בתאריך</th><th>סוג</th><th>סטטוס</th></tr></thead>
            <tbody>
              {emailHistory.map(e => (
                <tr key={e.id}>
                  <td className="td-mono">{fmtSentAt(e.sent_at)}</td>
                  <td>{e.stage_days_overdue !== null ? `אוטומטי (חריגה ${e.stage_days_overdue} ימים)` : 'ידני'}</td>
                  <td>
                    {e.status === 'sent' && <span className="badge b-green">נשלח</span>}
                    {e.status === 'failed' && <span className="badge b-red" title={e.error_message || ''}>נכשל</span>}
                    {e.status === 'skipped' && <span className="badge b-gray">דולג</span>}
                  </td>
                </tr>
              ))}
              {emailHistory.length === 0 && <tr><td colSpan={3} className="td-muted">עדיין לא נשלחו מיילי תזכורת ללקוח זה</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showFormTypes && (
        <ClientFormTypesPanel clientId={client.id} onClose={() => setShowFormTypes(false)} onChanged={load} />
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">מחיקת {client.name}</div>
              <button className="close-btn" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="dynamic-banner" style={{ background: 'var(--red-lt)', borderColor: 'rgba(185,28,28,0.25)', color: 'var(--red)' }}>
              ⚠️ פעולה זו בלתי הפיכה. מחיקת הלקוח תמחק לצמיתות גם את <b>כל</b> ההיסטוריה שלו — כל הדיווחים והסימונים מכל החודשים, בלי אפשרות שחזור.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'מוחק…' : 'כן, מחק לצמיתות'}
              </button>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
