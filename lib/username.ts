// Shared by the login page (client) and admin/users provisioning (server) — the synthetic
// domain isn't a secret (the browser has to construct the same email to sign in), so it's a
// single NEXT_PUBLIC_ var rather than two copies.
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim().toLowerCase())
}

export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase()
  if (!USERNAME_RE.test(clean)) {
    throw new Error('שם משתמש לא תקין — אותיות/ספרות אנגליות, נקודה, מקף וקו תחתון בלבד, 3–32 תווים')
  }
  const domain = process.env.NEXT_PUBLIC_INTERNAL_AUTH_DOMAIN || 'staff.local'
  return `${clean}@${domain}`
}
