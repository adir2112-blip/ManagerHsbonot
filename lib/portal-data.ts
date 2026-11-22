// Server-only data access for the client portal (service role — callers MUST have verified the
// portal session first via getPortalSession).
import { createAdminClient } from '@/lib/supabase/admin'
import { israelToday } from '@/lib/checklist'
import { periodOf, shiftPeriod, samePeriod, type Period } from '@/lib/portal'

export const BUCKET = 'client-docs'
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel|text\/csv)$/

export function currentPeriod(): Period {
  const t = israelToday()
  return periodOf(t.year, t.month)
}

// A client may submit for the current period and the previous one (documents for Jan–Feb are
// typically sent in early March, before the VAT filing deadline).
export function allowedPeriods(): Period[] {
  const cur = currentPeriod()
  return [cur, shiftPeriod(cur, -1)]
}

export function isAllowedPeriod(p: Period): boolean {
  return allowedPeriods().some(a => samePeriod(a, p))
}

export async function clientCategories(clientId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('client_upload_categories')
    .select('category:category_id(id, name, icon, kind, sort_order, active)')
    .eq('client_id', clientId)
  return (data || [])
    .map((r: any) => r.category)
    .filter((c: any) => c && c.active)
    .sort((a: any, b: any) => a.sort_order - b.sort_order) as { id: string; name: string; icon: string; kind: 'upload' | 'pickup'; sort_order: number }[]
}

export async function clientSubmissions(clientId: string, p: Period) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('portal_submissions')
    .select('id, category_id, kind, file_name, file_size, original_size, mime_type, note, created_at')
    .eq('client_id', clientId).eq('period_year', p.year).eq('period_start_month', p.startMonth)
    .order('created_at', { ascending: false })
  return data || []
}
