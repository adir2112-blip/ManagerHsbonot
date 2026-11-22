import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPortalSession } from '@/lib/portal-session'
import { BUCKET, isAllowedPeriod } from '@/lib/portal-data'

// Lets the client remove something they uploaded by mistake — only for periods still open to them.
export async function DELETE(_req: Request, { params }: { params: { token: string; id: string } }) {
  const client = await getPortalSession(params.token)
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('portal_submissions')
    .select('id, client_id, file_path, period_year, period_start_month')
    .eq('id', params.id).maybeSingle()
  if (!row || row.client_id !== client.id) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  if (!isAllowedPeriod({ year: row.period_year, startMonth: row.period_start_month })) {
    return NextResponse.json({ error: 'התקופה נסגרה — לא ניתן למחוק' }, { status: 400 })
  }

  if (row.file_path) await admin.storage.from(BUCKET).remove([row.file_path])
  await admin.from('portal_submissions').delete().eq('id', row.id)
  return NextResponse.json({ ok: true })
}
