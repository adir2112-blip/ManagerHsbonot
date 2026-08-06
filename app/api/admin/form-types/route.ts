import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard
  const { data, error } = await ctx.supabase.from('form_types').select('*').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ formTypes: data })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const body = await req.json().catch(() => ({}))
  const { name, sort_order } = body || {}
  if (!name?.trim()) return NextResponse.json({ error: 'חסר שם טופס' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('form_types')
    .insert({ name: name.trim(), sort_order: sort_order ?? 0 })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ formType: data })
}
