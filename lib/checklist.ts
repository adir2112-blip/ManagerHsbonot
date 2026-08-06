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

export function computeMonthStatus(formTypes: FormType[], items: ChecklistItem[], year: number, month: number): MonthStatus {
  const applicable = applicableFormTypes(formTypes, year, month)
  const applicableIds = new Set(applicable.map(f => f.id))
  const checkedCount = items.filter(i => i.year === year && i.month === month && i.checked && applicableIds.has(i.form_type_id)).length
  const total = applicable.length
  return { total, checkedCount, complete: total > 0 && checkedCount === total }
}

// "Today" in Israel time, independent of the server/cron's own UTC clock — a Vercel Cron
// firing at a fixed UTC hour must not let the reminder-day-of-month check drift across DST.
export function israelToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const [year, month, day] = parts.split('-').map(Number)
  return { year, month, day }
}

// Reminder gating: never before reminder_day_of_month in the relevant month; then re-arm
// every reminder_interval_days after the last one actually sent (status irrelevant — 'sent',
// 'failed' and 'skipped' are all retried the same way, since 'skipped' just means "no provider
// configured yet" and should catch up automatically once RESEND_API_KEY is set).
export function shouldSendReminder(opts: {
  today: { year: number; month: number; day: number }
  relevantYear: number
  relevantMonth: number
  reminderDayOfMonth: number
  reminderIntervalDays: number
  lastSentAt: Date | null
}): boolean {
  const { today, relevantYear, relevantMonth, reminderDayOfMonth, reminderIntervalDays, lastSentAt } = opts
  if (today.year !== relevantYear || today.month !== relevantMonth) return false
  if (today.day < reminderDayOfMonth) return false
  if (!lastSentAt) return true
  const msSinceLast = Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(lastSentAt.getUTCFullYear(), lastSentAt.getUTCMonth(), lastSentAt.getUTCDate())
  return msSinceLast >= reminderIntervalDays * 86400000
}
