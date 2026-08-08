// Pure domain logic — no I/O, so it's cheap to unit-test (tests/checklist.test.ts) and reused
// identically by the UI (client card / history) and the reminders cron (lib/email.ts caller).

export type Cycle = 'monthly' | 'bimonthly'

export interface YearMonth {
  year: number
  month: number // 1-12
}

function monthIndex(y: number, m: number): number {
  return y * 12 + (m - 1)
}

// A bimonthly client's parity is anchored to cycle_start_date; editing that date later
// re-anchors parity for ALL history — callers rendering history should union this result
// with any month that already has checklist_items rows, so an edit never hides existing data.
export function isMonthRelevant(cycle: Cycle, cycleStartDate: string, year: number, month: number): boolean {
  const start = new Date(cycleStartDate + 'T00:00:00Z')
  const startY = start.getUTCFullYear()
  const startM = start.getUTCMonth() + 1
  const target = monthIndex(year, month)
  const startIdx = monthIndex(startY, startM)
  if (target < startIdx) return false
  if (cycle === 'monthly') return true
  return (target - startIdx) % 2 === 0
}

// Inclusive list of relevant {year, month} from cycle_start_date through (throughYear, throughMonth).
export function listRelevantMonths(cycle: Cycle, cycleStartDate: string, throughYear: number, throughMonth: number): YearMonth[] {
  const start = new Date(cycleStartDate + 'T00:00:00Z')
  const startY = start.getUTCFullYear()
  const startM = start.getUTCMonth() + 1
  const out: YearMonth[] = []
  let y = startY, m = startM
  const throughIdx = monthIndex(throughYear, throughMonth)
  while (monthIndex(y, m) <= throughIdx) {
    if (isMonthRelevant(cycle, cycleStartDate, y, m)) out.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

export interface FormType {
  id: string
  active: boolean
  effective_from: string // ISO timestamp
}

export interface ChecklistItem {
  form_type_id: string
  year: number
  month: number
  checked: boolean
  continue_treatment?: boolean
}

// A form-type counts toward a given month only if it's currently active AND was already
// effective by the end of that month — this is what keeps adding a new form-type today from
// retroactively marking every past month "incomplete" (see plan doc for the full rationale).
export function applicableFormTypes(formTypes: FormType[], year: number, month: number): FormType[] {
  const endOfMonth = new Date(Date.UTC(year, month, 1)) // first day of NEXT month = exclusive upper bound
  return formTypes.filter(ft => ft.active && new Date(ft.effective_from) < endOfMonth)
}

export interface MonthStatus {
  total: number
  checkedCount: number
  complete: boolean
}

// "המשך טיפול" (continue_treatment) is an internal per-item override, separate from `checked`:
// it means "the client's paperwork is in, but our own handling of it isn't actually closed yet"
// (e.g. received but not yet filed with the tax authority). A month with it set on any item
// never reads as complete, no matter how many boxes are checked, until someone clears it.
export function computeMonthStatus(formTypes: FormType[], items: ChecklistItem[], year: number, month: number): MonthStatus {
  const applicable = applicableFormTypes(formTypes, year, month)
  const applicableIds = new Set(applicable.map(f => f.id))
  const monthItems = items.filter(i => i.year === year && i.month === month && applicableIds.has(i.form_type_id))
  const checkedCount = monthItems.filter(i => i.checked).length
  const total = applicable.length
  const hasOpenFollowUp = monthItems.some(i => i.continue_treatment)
  return { total, checkedCount, complete: total > 0 && checkedCount === total && !hasOpenFollowUp }
}

// Used by both the cron and the manual "שלח מייל תזכורת" button to name exactly which forms
// are still missing for a client's month, rather than just a count.
export function missingFormTypes(formTypes: FormType[], items: ChecklistItem[], year: number, month: number): FormType[] {
  const applicable = applicableFormTypes(formTypes, year, month)
  const checkedIds = new Set(items.filter(i => i.year === year && i.month === month && i.checked).map(i => i.form_type_id))
  return applicable.filter(ft => !checkedIds.has(ft.id))
}

// "Today" in Israel time, independent of the server/cron's own UTC clock — a Vercel Cron
// firing at a fixed UTC hour must not let the reminder-day-of-month check drift across DST.
export function israelToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const [year, month, day] = parts.split('-').map(Number)
  return { year, month, day }
}

export interface ClientStatus {
  relevant: boolean // false = client's cycle doesn't include the current month at all
  complete: boolean
  checkedCount: number
  total: number
  isBehind: boolean
  daysBehind: number
}

// Shared by the dashboard (per-client rows) and the topbar client search (so a search result
// shows the same "behind schedule, by how many days" signal without a second implementation).
export function computeClientStatus(opts: {
  cycle: Cycle
  cycleStartDate: string
  formTypes: FormType[]
  items: ChecklistItem[]
  today: { year: number; month: number; day: number }
  reminderDayOfMonth: number
}): ClientStatus {
  const relevant = isMonthRelevant(opts.cycle, opts.cycleStartDate, opts.today.year, opts.today.month)
  if (!relevant) return { relevant: false, complete: false, checkedCount: 0, total: 0, isBehind: false, daysBehind: 0 }
  const status = computeMonthStatus(opts.formTypes, opts.items, opts.today.year, opts.today.month)
  const isBehind = !status.complete && opts.today.day >= opts.reminderDayOfMonth
  const daysBehind = isBehind ? opts.today.day - opts.reminderDayOfMonth : 0
  return { relevant: true, complete: status.complete, checkedCount: status.checkedCount, total: status.total, isBehind, daysBehind }
}

export interface ReliabilityStats {
  totalMonths: number
  lateMonths: number
}

// "Late" means the month ever needed an automatic nag (a 'sent' reminder_events row) — not
// just whether it eventually got done. That's what actually cost the bookkeeper effort, so
// it's a better reliability signal than "complete or not" for a month that's long since closed.
// pastMonthsNewestFirst excludes the current in-progress month (only closed months count).
export function computeReliability(
  pastMonthsNewestFirst: YearMonth[],
  sentMonths: Set<string>,
  windowSize = 6
): ReliabilityStats {
  const window = pastMonthsNewestFirst.slice(0, windowSize)
  return {
    totalMonths: window.length,
    lateMonths: window.filter(m => sentMonths.has(`${m.year}-${m.month}`)).length,
  }
}

