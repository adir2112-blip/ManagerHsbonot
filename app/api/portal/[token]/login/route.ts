import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findClientByToken, issuePortalSession } from '@/lib/portal-session'
import { onlyDigits } from '@/lib/portal'
import { timingSafeEqual } from 'crypto'

const MAX_FAILS = 5
const WINDOW_MIN = 15

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const client = await findClientByToken(params.token)
  if (!client) return NextResponse.json({ error: 'הקישור אינו תקף' }, { status: 404 })

  const admin = createAdminClient()
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString()
  const { count } = await admin
    .from('portal_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id).eq('success', false).gte('created_at', since)
  if ((count ?? 0) >= MAX_FAILS) {
    return NextResponse.json({ error: `יותר מדי ניסיונות שגויים. נסו שוב בעוד ${WINDOW_MIN} דקות.` }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const digits = onlyDigits(body?.digits)
  const idDigits = onlyDigits(client.id_number)
  if (idDigits.length < 4) {
    return NextResponse.json({ error: 'לא הוגדר מספר זהות ללקוח זה. פנו למשרד.' }, { status: 400 })
  }
  const expected = Buffer.from(idDigits.slice(-4))
  const given = Buffer.from(digits.padEnd(4, 'x').slice(0, 4))
  const ok = digits.length === 4 && timingSafeEqual(expected, given)

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  await admin.from('portal_login_attempts').insert({ client_id: client.id, ip, success: ok })

  if (!ok) {
    const left = MAX_FAILS - (count ?? 0) - 1
    return NextResponse.json({ error: left > 0 ? `הספרות שגויות. נותרו ${left} ניסיונות.` : `הספרות שגויות. הגישה ננעלה ל-${WINDOW_MIN} דקות.` }, { status: 401 })
  }

  issuePortalSession(client.id, client.portal_token)
  return NextResponse.json({ ok: true })
}
