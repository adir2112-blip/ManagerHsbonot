/** @type {import('next').NextConfig} */

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: csp },
]

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  // Was staleTimes.dynamic: 0 (fixed a stale-checklist-count bug) — but that disables the
  // Router Cache for EVERY navigation everywhere, which is what made clicking around feel
  // sluggish (every page visit re-hits Supabase, even unrelated ones, instead of using the
  // client-side cache). A short 5s bound keeps navigation snappy for normal back-and-forth
  // clicking while capping worst-case staleness to something no one will actually notice
  // (checking a box, then immediately clicking to another page, still shows fresh data —
  // ChecklistMonth also calls router.refresh() itself right after a toggle/note save).
  experimental: {
    staleTimes: { dynamic: 5 },
  },
}

module.exports = nextConfig
