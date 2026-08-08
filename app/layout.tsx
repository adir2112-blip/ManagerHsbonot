import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'מעקב טפסים חודשי',
  description: 'מערכת מעקב טפסים חודשיים למשרד הנהלת חשבונות',
  manifest: '/manifest.json',
  // Explicitly setting `icons` here overrides Next.js's automatic detection of app/icon.svg —
  // it has to be listed alongside `apple`, or the regular browser-tab favicon silently vanishes.
  icons: { icon: '/icon.svg', apple: '/icons/icon-180.png' },
  // "Add to Home Screen" on iOS ignores manifest.json entirely — these are what actually make
  // it open full-screen (no Safari chrome) instead of just bookmarking the URL.
  appleWebApp: {
    capable: true,
    title: 'מעקב טפסים',
    statusBarStyle: 'black-translucent',
  },
}

// Without this, mobile browsers render the page at a virtual ~980px "desktop" viewport and
// scale it down to fit — which is exactly the shrunken, cut-off layout seen on a real phone.
// The @media (max-width: 768px) rules in globals.css never even trigger without this.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#059669',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <footer style={{ textAlign: 'center', padding: '20px 12px', fontSize: 12, color: 'var(--text3)' }}>
          כל הזכויות שמורות ל-A.L ייעוץ ותכנון מערכות
        </footer>
      </body>
    </html>
  )
}
