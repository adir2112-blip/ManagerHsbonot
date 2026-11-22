import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPortalSession } from '@/lib/portal-session'
import { ALLOWED_MIME, BUCKET, MAX_FILE_BYTES, clientCategories, isAllowedPeriod } from '@/lib/portal-data'
import { parsePeriodKey, periodKey } from '@/lib/portal'

// Issues a one-time signed upload URL so the browser uploads straight to Supabase Storage —
// file bytes never pass through the Vercel function (avoids its 4.5MB body limit).
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const client = await getPortalSession(params.token)
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const period = parsePeriodKey(body?.period)
  if (!period || !isAllowedPeriod(period)) return NextResponse.json({ error: 'תקופה לא תקינה' }, { status: 400 })
  const size = Number(body?.size)
  if (!size || size > MAX_FILE_BYTES) return NextResponse.json({ error: 'הקובץ גדול מדי (עד 15MB)' }, { status: 400 })
  const mime = String(body?.mime || '')
  if (!ALLOWED_MIME.test(mime)) return NextResponse.json({ error: 'סוג קובץ לא נתמך — ניתן להעלות תמונות, PDF, Excel או Word' }, { status: 400 })

  const categories = await clientCategories(client.id)
  const cat = categories.find(c => c.id === body?.category_id)
  if (!cat || cat.kind !== 'upload') return NextResponse.json({ error: 'קטגוריה לא תקינה' }, { status: 400 })

  const ext = (String(body?.file_name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const path = `${client.id}/${periodKey(period)}/${cat.id}/${randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'שגיאה בהכנת ההעלאה' }, { status: 500 })

  return NextResponse.json({ path, token: data.token })
}
