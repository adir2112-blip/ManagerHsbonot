import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const body = await req.json().catch(() => ({}))
  const { full_name, role, active, notification_email } = body || {}
  if (role !== undefined && role !== 'admin' && role !== 'bookkeeper') {
    return NextResponse.json({ error: 'תפקיד לא תקין' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Role lives in both the JWT app_metadata (for RLS) and profiles.role (for the users
  // screen) — both must move together or the two go out of sync.
  if (role !== undefined) {
    const { error: metaErr } = await admin.auth.admin.updateUserById(params.id, { app_metadata: { role } })
    if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (full_name !== undefined) patch.full_name = full_name
  if (role !== undefined) patch.role = role
  if (active !== undefined) patch.active = active
  if (notification_email !== undefined) patch.notification_email = notification_email

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('profiles').update(patch).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Deactivating an employee also blocks login immediately (belt-and-suspenders — RLS/role
  // checks already gate the app, but this stops the Auth handshake itself).
  if (active === false) {
    await admin.auth.admin.updateUserById(params.id, { ban_duration: '876000h' }).catch(() => {})
  } else if (active === true) {
    await admin.auth.admin.updateUserById(params.id, { ban_duration: 'none' }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
