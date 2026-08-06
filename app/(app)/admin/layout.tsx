import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUser()
  if (!ctx || ctx.role !== 'admin') redirect('/dashboard') // belt-and-suspenders — middleware.ts already enforces this
  return <>{children}</>
}
