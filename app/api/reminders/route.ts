import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-guard'

// ?due=1        — only reminders due now, not yet done (used for the popup poll). Always
//                 scoped to the caller's own reminders regardless of role — popups are personal.
// ?scope=all    — full list for the personal calendar page; only admins may actually see
//                 everyone's (non-admins are silently forced back to their own, even if they
//                 pass scope=all — this endpoint decides visibility, not the client).
export async function GET(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const url = new URL(req.url)
  const due = url.searchParams.get('due') === '1'
  const scopeAll = url.searchParams.get('scope') === 'all' && !due

  let query = ctx.supabase
    .from('personal_reminders')
    .select('*, client:client_id(id, name), form_type:form_type_id(id, name)')
    .order('remind_at')

  if (scopeAll && ctx.role === 'admin') {
    // no created_by filter — admin sees everyone's
  } else {
    query = query.eq('created_by', ctx.user.id)
  }

  if (due) {
    query = query.eq('is_done', false).lte('remind_at', new Date().toISOString())
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reminders: data })
}

export async function POST(req: Request) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { client_id, form_type_id, remind_at, note } = body || {}
  if (!client_id || !remind_at) return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('personal_reminders')
    .insert({ client_id, form_type_id: form_type_id || null, remind_at, note: note || null, created_by: ctx.user.id })
    .select('*, client:client_id(id, name), form_type:form_type_id(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reminder: data })
}
