import { requireAuth } from '@/lib/api-guard'
import { isMonthRelevant, computeMonthStatus, israelToday } from '@/lib/checklist'
import { fetchClientFormTypeMap } from '@/lib/client-form-types'

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

function csvCell(value: string): string {
  // Quote every cell and escape embedded quotes — simplest way to stay correct for names/notes
  // that may contain commas, quotes, or newlines, without pulling in a CSV library.
  return `"${value.replace(/"/g, '""')}"`
}

// Plain CSV rather than a real .xlsx — Excel opens CSV natively, and it needs zero new
// dependencies. The UTF-8 BOM is what makes Excel (as opposed to a text editor) render the
// Hebrew correctly instead of guessing the wrong codepage.
export async function GET() {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error
  const { ctx } = guard

  const today = israelToday()
  const { data: clients } = await ctx.supabase
    .from('clients')
    .select('*, assigned_employee:assigned_employee_id(id, full_name)')
    .eq('active', true)
    .order('name')
  const clientIds = (clients || []).map(c => c.id)

  const [{ data: formTypes }, { data: items }, formTypeMap] = await Promise.all([
    ctx.supabase.from('form_types').select('*'),
    ctx.supabase.from('checklist_items').select('*').eq('year', today.year).eq('month', today.month),
    fetchClientFormTypeMap(ctx.supabase, clientIds),
  ])

  const header = ['שם לקוח', 'טלפון', 'אימייל', 'מחזוריות', 'עובדת אחראית', 'סטטוס החודש', 'הושלמו/סה"כ']
  const rows = [header]

  for (const c of clients || []) {
    const relevant = isMonthRelevant(c.cycle, c.cycle_start_date, today.year, today.month)
    const selectedIds = formTypeMap.get(c.id) || new Set()
    const clientFormTypes = (formTypes || []).filter(ft => selectedIds.has(ft.id))
    const clientItems = (items || []).filter(i => i.client_id === c.id)
    const status = relevant ? computeMonthStatus(clientFormTypes, clientItems, today.year, today.month) : null
    const statusLabel = !relevant ? 'לא רלוונטי החודש' : status?.complete ? 'הושלם' : 'בטיפול/בפיגור'
    rows.push([
      c.name,
      c.phone || '',
      c.email || '',
      c.cycle === 'monthly' ? 'חודשי' : 'דו-חודשי',
      c.assigned_employee?.full_name || '',
      statusLabel,
      status ? `${status.checkedCount}/${status.total}` : '',
    ])
  }

  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')
  const filename = `לקוחות-${HEBREW_MONTHS[today.month - 1]}-${today.year}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clients-export.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
