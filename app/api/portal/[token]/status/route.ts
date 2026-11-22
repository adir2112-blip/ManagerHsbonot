import { NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-session'
import { allowedPeriods, clientCategories, clientSubmissions, currentPeriod, isAllowedPeriod } from '@/lib/portal-data'
import { parsePeriodKey, periodKey, periodLabel } from '@/lib/portal'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const client = await getPortalSession(params.token)
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const requested = parsePeriodKey(new URL(req.url).searchParams.get('period'))
  const period = requested && isAllowedPeriod(requested) ? requested : currentPeriod()

  const [categories, submissions] = await Promise.all([
    clientCategories(client.id),
    clientSubmissions(client.id, period),
  ])

  return NextResponse.json({
    client: { name: client.name },
    period: { key: periodKey(period), label: periodLabel(period) },
    periods: allowedPeriods().map(p => ({ key: periodKey(p), label: periodLabel(p) })),
    categories,
    submissions,
  })
}
