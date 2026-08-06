// Typed fetch helpers for client components. All business data flows through these against
// the server Route Handlers (RLS-enforced) — components never call Supabase directly for
// anything but the Auth handshake itself (see lib/supabase/client.ts).
'use client'

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error || 'שגיאה')
  return data as T
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return fetch(path, { credentials: 'same-origin' }).then(handle<T>)
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle<T>)
}

export const apiPost = <T = unknown>(path: string, body?: unknown) => send<T>(path, 'POST', body)
export const apiPatch = <T = unknown>(path: string, body?: unknown) => send<T>(path, 'PATCH', body)
export const apiDelete = <T = unknown>(path: string) => send<T>(path, 'DELETE')
