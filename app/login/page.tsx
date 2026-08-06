'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usernameToEmail } from '@/lib/username'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const email = usernameToEmail(username)
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error('שם משתמש או סיסמה שגויים')
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>מעקב טפסים חודשי</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>התחברות למערכת</div>
        </div>
        <div className="form-group">
          <label className="form-label">שם משתמש</label>
          <input
            className="form-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">סיסמה</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="badge b-red" style={{ marginBottom: 14 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'מתחבר…' : 'התחברות'}
        </button>
      </form>
    </div>
  )
}
