'use client'
import { useEffect, useState } from 'react'

// Computed client-side only (useEffect, not inline in render) — the server that renders the
// first HTML runs in a different timezone than the user's device, so doing this inline would
// flash the wrong greeting for a moment and trip a hydration mismatch warning.
function greetingFor(hour: number, firstName: string): { icon: string; text: string } {
  if (hour >= 5 && hour < 12) return { icon: '☀️', text: `בוקר טוב, ${firstName}! מה שלומך היום?` }
  if (hour >= 12 && hour < 17) return { icon: '🌤️', text: `צהריים טובים, ${firstName}! מה שלומך היום?` }
  return { icon: '🌙', text: `ערב טוב, ${firstName}! מה שלומך היום?` }
}

export default function Greeting({ fullName }: { fullName: string }) {
  const firstName = fullName.split(' ')[0]
  const [greeting, setGreeting] = useState<{ icon: string; text: string } | null>(null)
  useEffect(() => { setGreeting(greetingFor(new Date().getHours(), firstName)) }, [firstName])

  if (!greeting) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
      <span>{greeting.icon}</span>
      <span>{greeting.text}</span>
    </div>
  )
}
