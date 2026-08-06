import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'מעקב טפסים חודשי',
  description: 'מערכת מעקב טפסים חודשיים למשרד הנהלת חשבונות',
}

// Without this, mobile browsers render the page at a virtual ~980px "desktop" viewport and
// scale it down to fit — which is exactly the shrunken, cut-off layout seen on a real phone.
// The @media (max-width: 768px) rules in globals.css never even trigger without this.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
