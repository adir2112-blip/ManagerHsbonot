// Pure helpers for the client document portal — bimonthly VAT periods (Jan–Feb, Mar–Apr, …).
// No I/O, shared by server routes and client components.

export const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export interface Period {
  year: number
  startMonth: number // 1,3,5,7,9,11
}

export function periodOf(year: number, month: number): Period {
  return { year, startMonth: month % 2 === 1 ? month : month - 1 }
}

export function periodKey(p: Period): string {
  return `${p.year}-${String(p.startMonth).padStart(2, '0')}`
}

export function parsePeriodKey(key: string | null | undefined): Period | null {
  if (!key) return null
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return null
  const year = Number(m[1]), startMonth = Number(m[2])
  if (year < 2000 || year > 2100 || startMonth < 1 || startMonth > 11 || startMonth % 2 === 0) return null
  return { year, startMonth }
}

export function periodLabel(p: Period): string {
  return `${HEBREW_MONTHS[p.startMonth - 1]}–${HEBREW_MONTHS[p.startMonth]} ${p.year}`
}

export function shiftPeriod(p: Period, delta: number): Period {
  const idx = p.year * 6 + (p.startMonth - 1) / 2 + delta
  return { year: Math.floor(idx / 6), startMonth: (idx % 6) * 2 + 1 }
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.year === b.year && a.startMonth === b.startMonth
}

// Newest first, including `current`.
export function recentPeriods(current: Period, count: number): Period[] {
  return Array.from({ length: count }, (_, i) => shiftPeriod(current, -i))
}

export function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}
