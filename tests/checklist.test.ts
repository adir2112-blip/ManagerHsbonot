import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMonthRelevant,
  listRelevantMonths,
  applicableFormTypes,
  computeMonthStatus,
  computeReliability,
} from '../lib/checklist'

test('monthly client is relevant every month from start date onward', () => {
  assert.equal(isMonthRelevant('monthly', '2025-03-15', 2025, 3), true)
  assert.equal(isMonthRelevant('monthly', '2025-03-15', 2025, 6), true)
  assert.equal(isMonthRelevant('monthly', '2025-03-15', 2025, 1), false) // before start
})

test('bimonthly client alternates from its start month', () => {
  assert.equal(isMonthRelevant('bimonthly', '2025-03-01', 2025, 3), true) // start month
  assert.equal(isMonthRelevant('bimonthly', '2025-03-01', 2025, 4), false)
  assert.equal(isMonthRelevant('bimonthly', '2025-03-01', 2025, 5), true)
  assert.equal(isMonthRelevant('bimonthly', '2025-03-01', 2025, 6), false)
  assert.equal(isMonthRelevant('bimonthly', '2025-03-01', 2026, 3), true) // parity preserved across year boundary
})

test('listRelevantMonths returns only the relevant months, inclusive', () => {
  const months = listRelevantMonths('bimonthly', '2025-01-01', 2025, 6)
  assert.deepEqual(months, [
    { year: 2025, month: 1 },
    { year: 2025, month: 3 },
    { year: 2025, month: 5 },
  ])
})

test('applicableFormTypes excludes types not yet effective that month, includes ones effective by month end', () => {
  const types = [
    { id: 'a', active: true, effective_from: '2025-01-01T00:00:00Z' },
    { id: 'b', active: true, effective_from: '2025-06-15T00:00:00Z' }, // added mid-June
    { id: 'c', active: false, effective_from: '2024-01-01T00:00:00Z' }, // deactivated
  ]
  assert.deepEqual(applicableFormTypes(types, 2025, 5).map(t => t.id), ['a']) // May: b not yet effective
  assert.deepEqual(applicableFormTypes(types, 2025, 6).map(t => t.id), ['a', 'b']) // June: b now counts
})

test('adding a new form-type does not retroactively break a completed past month', () => {
  const typesBefore = [{ id: 'a', active: true, effective_from: '2025-01-01T00:00:00Z' }]
  const items = [{ form_type_id: 'a', year: 2025, month: 1, checked: true }]
  assert.equal(computeMonthStatus(typesBefore, items, 2025, 1).complete, true)

  // Admin adds a new type today (effective now) — January must still read as complete.
  const typesAfter = [...typesBefore, { id: 'b', active: true, effective_from: '2025-08-01T00:00:00Z' }]
  assert.equal(computeMonthStatus(typesAfter, items, 2025, 1).complete, true)
})

test('computeMonthStatus is incomplete until every applicable type is checked', () => {
  const types = [
    { id: 'a', active: true, effective_from: '2025-01-01T00:00:00Z' },
    { id: 'b', active: true, effective_from: '2025-01-01T00:00:00Z' },
  ]
  const items = [{ form_type_id: 'a', year: 2025, month: 7, checked: true }]
  const status = computeMonthStatus(types, items, 2025, 7)
  assert.equal(status.total, 2)
  assert.equal(status.checkedCount, 1)
  assert.equal(status.complete, false)
})

test('computeReliability counts only months that needed a nag, within the trailing window', () => {
  const pastMonthsNewestFirst = [
    { year: 2025, month: 7 }, { year: 2025, month: 6 }, { year: 2025, month: 5 },
    { year: 2025, month: 4 }, { year: 2025, month: 3 }, { year: 2025, month: 2 },
    { year: 2025, month: 1 }, // 7 months of history — window of 6 should drop this oldest one
  ]
  const sentMonths = new Set(['2025-7', '2025-5', '2025-1'])
  const result = computeReliability(pastMonthsNewestFirst, sentMonths, 6)
  assert.equal(result.totalMonths, 6)
  assert.equal(result.lateMonths, 2) // July and May are within the window; January is dropped
})

test('computeReliability with a perfect record reports zero late months', () => {
  const pastMonthsNewestFirst = [{ year: 2025, month: 3 }, { year: 2025, month: 2 }]
  const result = computeReliability(pastMonthsNewestFirst, new Set(), 6)
  assert.equal(result.totalMonths, 2)
  assert.equal(result.lateMonths, 0)
})
