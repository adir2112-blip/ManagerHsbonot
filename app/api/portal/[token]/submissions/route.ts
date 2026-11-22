import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPortalSession } from '@/lib/portal-session'
import { BUCKET, clientCategories, isAllowedPeriod } from '@/lib/portal-data'
import { parsePeriodKey, periodKey } from '@/lib/portal'

// Records a submission: either a file that was just uploaded via the signed URL (kind='file'),
// a "no documents this period" mark (kind='none'), or "ready for pickup" (kind='pickup').
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const client = await getPortalSession(params.token)
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const period = parsePeriodKey(body?.period)
  if (!period || !isAllowedPeriod(period)) return NextResponse.json({ error: 'תקופה לא תקינה' }, { status: 400 })

  const categories = await clientCategories(client.id)
  const cat = categories.find(c => c.id === body?.category_id)
  if (!cat) return NextResponse.json({ error: 'קטגוריה לא תקינה' }, { status: 400 })

  const kind = body?.kind
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null
  const admin = createAdminClient()
  const base = { client_id: client.id, category_id: cat.id, period_year: period.year, period_start_month: period.startMonth, note }

  if (kind === 'file') {
    const path = String(body?.path || '')
    const prefix = `${client.id}/${periodKey(period)}/${cat.id}/`
    if (!path.startsWith(prefix) || path.includes('..')) return NextResponse.json({ error: 'נתיב לא תקין' }, { status: 400 })
    // Make sure the object really landed in storage before recording it.
    const folder = path.slice(0, path.lastIndexOf('/'))
    const fileOnly = path.slice(path.lastIndexOf('/') + 1)
    const { data: listed } = await admin.storage.from(BUCKET).list(folder, { search: fileOnly })
    const obj = (listed || []).find(o => o.name === fileOnly)
    if (!obj) return NextResponse.json({ error: 'הקובץ לא הועלה בהצלחה' }, { status: 400 })
    const { data, error } = await admin.from('portal_submissions').insert({
      ...base, kind: 'file', file_path: path,
      file_name: String(body?.file_name || fileOnly).slice(0, 200),
      file_size: (obj.metadata as any)?.size ?? Number(body?.size) ?? null,
      original_size: Number(body?.original_size) || null,
      mime_type: (obj.metadata as any)?.mimetype ?? body?.mime ?? null,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  }

  if (kind === 'none' || kind === 'pickup') {
    if (kind === 'pickup' && cat.kind !== 'pickup') return NextResponse.json({ error: 'קטגוריה לא תקינה' }, { status: 400 })
    const { data, error } = await admin.from('portal_submissions').insert({ ...base, kind }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  }

  return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400 })
}
