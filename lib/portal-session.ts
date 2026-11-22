// Server-only: signed session cookie for the client portal. Portal visitors aren't Supabase
// Auth users, so after a successful 4-digit login we issue an HMAC-signed cookie bound to the
// client id + portal token (regenerating the link invalidates every existing session).
import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const COOKIE = 'portal_session'
const MAX_AGE_SEC = 60 * 60 * 8 // 8 hours

function secret(): string {
  const s = process.env.PORTAL_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('missing portal session secret')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issuePortalSession(clientId: string, portalToken: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  const payload = `${clientId}.${exp}`
  const value = `${payload}.${sign(`${payload}.${portalToken}`)}`
  cookies().set(COOKIE, value, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE_SEC,
  })
}

export function clearPortalSession() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

export interface PortalClient {
  id: string
  name: string
  id_number: string | null
  portal_token: string
  portal_enabled: boolean
  active: boolean
}

export async function findClientByToken(token: string): Promise<PortalClient | null> {
  if (!/^[a-f0-9]{32,64}$/.test(token)) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('clients')
    .select('id, name, id_number, portal_token, portal_enabled, active')
    .eq('portal_token', token)
    .maybeSingle()
  if (!data || !data.active || !data.portal_enabled) return null
  return data as PortalClient
}

// Returns the client when the request carries a valid session for THIS portal link.
export async function getPortalSession(token: string): Promise<PortalClient | null> {
  const client = await findClientByToken(token)
  if (!client) return null
  const raw = cookies().get(COOKIE)?.value
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [clientId, expStr, sig] = parts
  if (clientId !== client.id) return null
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null
  const expected = Buffer.from(sign(`${clientId}.${expStr}.${client.portal_token}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return client
}
