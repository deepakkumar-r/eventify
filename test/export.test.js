import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, validateInput } from '../src/planner.js';
import { formatPlanText } from '../src/export.js';

const TODAY = '2026-10-21';
const plan = buildPlan(validateInput({ type: 'wedding', guests: '120', budget: '500000', date: '2026-12-01', theme: 'Rustic' }, TODAY).value, TODAY);

test('formatPlanText contains every section in order', () => {
  const text = formatPlanText(plan);
  const order = ['CELEBRATION & EVENT PLANNER', 'BUDGET', 'TIMELINE', 'VENDOR CHECKLIST', 'IDEAS'].map((h) => text.indexOf(h));
  assert.ok(order.every((i) => i >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('formatPlanText reports facts accurately', () => {
  const text = formatPlanText(plan);
  assert.ok(text.includes('Event: wedding | Date: 2026-12-01 | Guests: 120'));
  assert.ok(text.includes(`Readiness score: ${plan.evaluation.score}/100`));
  assert.ok(text.includes('Venue: 30% (150000)'));
  assert.ok(text.includes('(behind schedule)'));
  assert.ok(text.includes('- Venue contract signed'));
  assert.ok(text.includes('Rustic'));
});

test('formatPlanText omits the late marker when nothing is late', () => {
  const calm = buildPlan(validateInput({ type: 'birthday', guests: '10', budget: '5000', date: '2027-06-01', theme: '' }, TODAY).value, TODAY);
  assert.ok(!formatPlanText(calm).includes('behind schedule'));
});
