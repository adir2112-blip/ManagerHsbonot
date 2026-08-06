'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from '@/lib/nav-items'

interface TopbarProps {
  fullName: string
  role: 'admin' | 'bookkeeper'
}

export default function Topbar({ fullName, role }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = fullName.split(' ').map(p => p[0]).join('').slice(0, 2)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <span className="brand-dot" />
        <span>מעקב טפסים חודשי</span>
      </div>
      <div className="topbar-nav">
        {NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} className={`nav-btn${pathname === item.href ? ' active' : ''}`}>
            {item.label}
          </Link>
        ))}
        {role === 'admin' && ADMIN_NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} className={`nav-btn${pathname === item.href ? ' active' : ''}`}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="topbar-right">
        <div className="user-pill">
          <div className="avatar">{initials}</div>
          <div>
            <div className="user-name">{fullName}</div>
            <div className="user-role">{role === 'admin' ? 'מנהל ראשי' : 'הנהלת חשבונות'}</div>
          </div>
        </div>
        <button className="btn btn-white btn-sm" onClick={handleLogout}>יציאה</button>
      </div>
    </div>
  )
}
