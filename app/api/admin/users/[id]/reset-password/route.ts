import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// Self-service "forgot password" can't work here (the account's email is synthetic and
// undeliverable) — resetting is admin-only from day one.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const body = await req.json().catch(() => ({}))
  const { password } = body || {}
  if (!password || String(password).length < 8) {
    return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 8 תווים' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(params.id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
