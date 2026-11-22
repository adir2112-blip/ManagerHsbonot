import type { Metadata } from 'next'
import { findClientByToken, getPortalSession } from '@/lib/portal-session'
import PortalApp from '@/components/portal/PortalApp'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'העלאת מסמכים למשרד', robots: { index: false, follow: false } }

export default async function PortalPage({ params }: { params: { token: string } }) {
  const client = await findClientByToken(params.token)
  if (!client) {
    return (
      <div className="portal-wrap">
        <div className="portal-login-card" style={{ textAlign: 'center' }}>
          <div className="portal-logo">🔒</div>
          <div className="portal-h1">הקישור אינו תקף</div>
          <div className="portal-sub">ייתכן שהקישור הוחלף או פג תוקפו. פנו למשרד לקבלת קישור עדכני.</div>
        </div>
      </div>
    )
  }
  const session = await getPortalSession(params.token)
  const firstName = client.name.split(' ')[0]
  return <PortalApp token={params.token} firstName={firstName} initiallyAuthed={!!session} />
}
