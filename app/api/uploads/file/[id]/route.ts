import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET } from '@/lib/portal-data'

// Staff-only: redirects to a short-lived signed URL for a client's uploaded file.
// ?download=1 forces a download with the original file name; otherwise opens inline.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const { data: row } = await ctx.supabase.from('portal_submissions').select('file_path, file_name').eq('id', params.id).maybeSingle()
  if (!row?.file_path) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  const download = new URL(req.url).searchParams.get('download') === '1'
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(row.file_path, 120, download ? { download: row.file_name || true } : undefined)
  if (error || !data) return NextResponse.json({ error: 'שגיאה' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
