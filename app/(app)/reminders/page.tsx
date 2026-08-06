import { getCurrentUser } from '@/lib/supabase/server'
import RemindersCalendar from '@/components/RemindersCalendar'

export default async function RemindersPage() {
  const ctx = await getCurrentUser()
  if (!ctx) return null
  return <RemindersCalendar isAdmin={ctx.role === 'admin'} />
}
