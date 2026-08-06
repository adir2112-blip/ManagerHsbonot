// One-off: creates the very first admin account. Run once via `npx tsx scripts/bootstrap-admin.ts`.
// After this, all further user provisioning goes through the app's own /admin/users screen —
// this script exists only to break the chicken-and-egg problem of needing an admin to create admins.
import fs from 'node:fs'
import path from 'node:path'

// Next.js loads .env.local automatically; a standalone tsx script doesn't, so load it here.
const envPath = path.join(__dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

import { createAdminClient, usernameToEmail } from '../lib/supabase/admin'

async function main() {
  const username = process.argv[2]
  const password = process.argv[3]
  const fullName = process.argv[4] || username
  if (!username || !password) {
    console.error('Usage: npx tsx scripts/bootstrap-admin.ts <username> <password> [full_name]')
    process.exit(1)
  }

  const admin = createAdminClient()
  const email = usernameToEmail(username)

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  })
  if (createErr || !created?.user) {
    console.error('createUser failed:', createErr?.message)
    process.exit(1)
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    username: username.toLowerCase(),
    full_name: fullName,
    role: 'admin',
  })
  if (profileErr) {
    console.error('profiles insert failed:', profileErr.message)
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    process.exit(1)
  }

  console.log(`Admin created: username=${username} (login email under the hood: ${email})`)
}

main()
