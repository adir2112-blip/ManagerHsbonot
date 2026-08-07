'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPatch } from '@/lib/client'

interface Reminder {
  id: string
  remind_at: string
  note: string | null
  client: { id: string; name: string } | null
  form_type: { id: string; name: string } | null
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function TodayReminders({ reminders }: { reminders: Reminder[] }) {
  const router = useRouter()
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  async function markDone(id: string) {
    setDoneIds(s => new Set(s).add(id))
    await apiPatch(`/api/reminders/${id}`, { is_done: true })
    router.refresh()
  }

  const visible = reminders.filter(r => !doneIds.has(r.id))

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">תזכורות שהגיע זמנן</div></div>
      <div className="card-pad">
        {visible.length === 0 && <div className="td-muted">אין תזכורות ממתינות</div>}
        {visible.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
            <div>
              {r.client && <Link href={`/clients/${r.client.id}`}>{r.client.name}</Link>}
              {r.form_type && <span className="td-muted" style={{ marginRight: 6 }}> · {r.form_type.name}</span>}
              {r.note && <div className="td-muted" style={{ fontSize: 12 }}>{r.note}</div>}
              <div style={{ color: 'var(--text3)', fontSize: 11 }}>{fmt(r.remind_at)}</div>
            </div>
            <button className="btn btn-xs" onClick={() => markDone(r.id)}>✓ טופל</button>
          </div>
        ))}
      </div>
    </div>
  )
}
