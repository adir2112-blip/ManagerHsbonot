import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMonthRelevant,
  listRelevantMonths,
  applicableFormTypes,
  computeMonthStatus,
  shouldSendReminder,
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

test('shouldSendReminder: no reminder before reminder_day_of_month', () => {
  assert.equal(shouldSendReminder({
    today: { year: 2025, month: 8, day: 5 },
    relevantYear: 2025, relevantMonth: 8,
    reminderDayOfMonth: 10, reminderIntervalDays: 3,
    lastSentAt: null,
  }), false)
})

test('shouldSendReminder: fires once threshold day is reached with no prior send', () => {
  assert.equal(shouldSendReminder({
    today: { year: 2025, month: 8, day: 10 },
    relevantYear: 2025, relevantMonth: 8,
    reminderDayOfMonth: 10, reminderIntervalDays: 3,
    lastSentAt: null,
  }), true)
})

test('shouldSendReminder: nags again only after the interval has elapsed', () => {
  const lastSentAt = new Date(Date.UTC(2025, 7, 10))
  assert.equal(shouldSendReminder({
    today: { year: 2025, month: 8, day: 12 },
    relevantYear: 2025, relevantMonth: 8,
    reminderDayOfMonth: 10, reminderIntervalDays: 3,
    lastSentAt,
  }), false) // only 2 days since last send
  assert.equal(shouldSendReminder({
    today: { year: 2025, month: 8, day: 13 },
    relevantYear: 2025, relevantMonth: 8,
    reminderDayOfMonth: 10, reminderIntervalDays: 3,
    lastSentAt,
  }), true) // 3 days since last send
})
