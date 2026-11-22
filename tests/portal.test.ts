import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodOf, periodKey, parsePeriodKey, periodLabel, shiftPeriod, recentPeriods } from '../lib/portal'

test('periodOf maps months to bimonthly VAT periods', () => {
  assert.deepEqual(periodOf(2026, 1), { year: 2026, startMonth: 1 })
  assert.deepEqual(periodOf(2026, 2), { year: 2026, startMonth: 1 })
  assert.deepEqual(periodOf(2026, 11), { year: 2026, startMonth: 11 })
  assert.deepEqual(periodOf(2026, 12), { year: 2026, startMonth: 11 })
})

test('period keys round-trip and reject even months', () => {
  assert.equal(periodKey({ year: 2026, startMonth: 3 }), '2026-03')
  assert.deepEqual(parsePeriodKey('2026-03'), { year: 2026, startMonth: 3 })
  assert.equal(parsePeriodKey('2026-04'), null)
  assert.equal(parsePeriodKey('garbage'), null)
})

test('shiftPeriod crosses year boundaries', () => {
  assert.deepEqual(shiftPeriod({ year: 2026, startMonth: 1 }, -1), { year: 2025, startMonth: 11 })
  assert.deepEqual(shiftPeriod({ year: 2025, startMonth: 11 }, 1), { year: 2026, startMonth: 1 })
  assert.equal(recentPeriods({ year: 2026, startMonth: 3 }, 3).map(periodKey).join(','), '2026-03,2026-01,2025-11')
})

test('periodLabel is Hebrew month range', () => {
  assert.equal(periodLabel({ year: 2026, startMonth: 11 }), 'נובמבר–דצמבר 2026')
})
