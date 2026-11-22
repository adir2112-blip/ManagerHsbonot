import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { data, error } = await guard.ctx.supabase.from('upload_categories').select('*').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categories: data })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'חסר שם קטגוריה' }, { status: 400 })
  const kind = body?.kind === 'pickup' ? 'pickup' : 'upload'
  const { data, error } = await guard.ctx.supabase.from('upload_categories')
    .insert({ name, icon: String(body?.icon || '📄').slice(0, 8), kind, sort_order: Number(body?.sort_order) || 0 })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ category: data })
}
