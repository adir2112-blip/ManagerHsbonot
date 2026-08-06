import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'מעקב טפסים חודשי',
  description: 'מערכת מעקב טפסים חודשיים למשרד הנהלת חשבונות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
