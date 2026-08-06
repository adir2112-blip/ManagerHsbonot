import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUser()
  if (!ctx) redirect('/login') // belt-and-suspenders — middleware.ts already enforces this

  const { data: profile } = await ctx.supabase.from('profiles').select('full_name').eq('id', ctx.user.id).single()

  return (
    <>
      <Topbar fullName={profile?.full_name || ctx.user.email || ''} role={ctx.role as 'admin' | 'bookkeeper'} />
      <div style={{ padding: '22px 26px' }}>{children}</div>
    </>
  )
}
