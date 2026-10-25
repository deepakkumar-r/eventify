import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_TYPES, MAX_GUESTS, MAX_THEME, parseDate, validateInput, allocateBudget, buildTimeline,
  buildChecklist, buildIdeas, buildPlan, evaluatePlan, scoreTitle,
} from '../src/planner.js';

const TODAY = '2026-10-21';
const good = { type: 'wedding', guests: '120', budget: '500000', date: '2027-03-01', theme: 'Rustic' };
const valid = (overrides = {}) => validateInput({ ...good, ...overrides }, TODAY);

test('parseDate accepts real dates only', () => {
  assert.ok(parseDate('2027-02-28'));
  assert.ok(parseDate('2028-02-29'), 'leap day');
  for (const bad of ['2027-02-30', '2027-13-01', '01/02/2027', '2027-2-3', '', null, undefined, 20270101]) {
    assert.equal(parseDate(bad), null, String(bad));
  }
});

test('validateInput accepts good input and normalises it', () => {
  const r = valid();
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.value, { type: 'wedding', guests: 120, budget: 500000, date: '2027-03-01', theme: 'Rustic' });
});

test('validateInput rejects bad values with one error per field', () => {
  const r = validateInput({ type: 'x', guests: '0', budget: '-5', date: '2020-01-01', theme: 'a'.repeat(61) }, TODAY);
  assert.equal(r.ok, false);
  assert.equal(r.value, null);
  assert.deepEqual(Object.keys(r.errors).sort(), ['budget', 'date', 'guests', 'theme', 'type']);
});

test('validateInput rejects prototype keys, decimals and non-numbers', () => {
  for (const type of ['__proto__', 'constructor', 'toString', '']) assert.equal(valid({ type }).ok, false, type);
  for (const guests of ['2.5', 'abc', '', '1e9', 'Infinity']) assert.equal(valid({ guests }).ok, false, guests);
  for (const budget of ['abc', '', 'NaN', '0', '1000000001']) assert.equal(valid({ budget }).ok, false, budget);
});

test('validateInput enforces boundaries', () => {
  assert.equal(valid({ guests: '1' }).ok, true);
  assert.equal(valid({ guests: String(MAX_GUESTS) }).ok, true);
  assert.equal(valid({ guests: String(MAX_GUESTS + 1) }).ok, false);
  assert.equal(valid({ budget: '1' }).ok, true);
  assert.equal(valid({ budget: '1000000000' }).ok, true);
  assert.equal(valid({ budget: '1000000001' }).errors.budget, 'Enter a budget greater than 0 and no more than 1000000000.');
  assert.equal(valid({ theme: 'a'.repeat(MAX_THEME) }).ok, true);
  assert.equal(valid({ date: TODAY }).ok, true, 'today is allowed');
  assert.equal(valid({ date: '2026-10-20' }).errors.date, 'Date cannot be in the past.');
  assert.equal(valid({ date: 'soon' }).errors.date, 'Enter a valid date.');
});

test('validateInput trims theme, rounds budget and tolerates missing input', () => {
  assert.equal(valid({ theme: '  Beach  ' }).value.theme, 'Beach');
  assert.equal(valid({ theme: undefined }).value.theme, '');
  assert.equal(valid({ budget: '1000.6' }).value.budget, 1001);
  assert.equal(validateInput(undefined, TODAY).ok, false);
});

test('every event type budget split totals 100% and has tasks, vendors and ideas', () => {
  for (const [name, cfg] of Object.entries(EVENT_TYPES)) {
    assert.equal(Object.values(cfg.split).reduce((a, b) => a + b, 0), 100, name);
    assert.ok(cfg.tasks.length && cfg.vendors.length && cfg.ideas.length, name);
    assert.equal(cfg.tasks.at(-1)[0], 0, `${name} ends on event day`);
  }
});

test('every event type produces a complete, internally consistent plan', () => {
  for (const type of Object.keys(EVENT_TYPES)) {
    const input = { type, guests: 50, budget: 100000, date: '2027-06-01', theme: 'Garden' };
    const plan = buildPlan(input, TODAY);
    assert.equal(plan.budget.reduce((sum, row) => sum + row.amount, 0), input.budget, type);
    assert.equal(plan.timeline.at(-1).due, input.date, type);
    assert.equal(plan.checklist.every((item) => item.done === false), true, type);
    assert.ok(plan.ideas.length >= EVENT_TYPES[type].ideas.length, type);
    assert.ok(plan.evaluation.score >= 0 && plan.evaluation.score <= 100, type);
  }
});

test('event configuration is immutable at every level', () => {
  assert.equal(Object.isFrozen(EVENT_TYPES), true);
  assert.equal(Object.isFrozen(EVENT_TYPES.wedding), true);
  assert.equal(Object.isFrozen(EVENT_TYPES.wedding.split), true);
  assert.equal(Object.isFrozen(EVENT_TYPES.wedding.tasks), true);
  assert.equal(Object.isFrozen(EVENT_TYPES.wedding.tasks[0]), true);
});

test('allocateBudget sums exactly to the total and never goes negative', () => {
  for (const total of [1, 7, 99, 999, 100001, 123457, 1_000_000_000]) {
    for (const type of Object.keys(EVENT_TYPES)) {
      const rows = allocateBudget(type, total);
      assert.equal(rows.reduce((s, r) => s + r.amount, 0), total, `${type} ${total}`);
      assert.ok(rows.every((r) => Number.isInteger(r.amount) && r.amount >= 0));
    }
  }
});

test('buildTimeline is sorted, ends on event day and flags late tasks', () => {
  const t = buildTimeline('wedding', '2026-12-01', TODAY);
  assert.deepEqual(t.map((x) => x.due), [...t.map((x) => x.due)].sort());
  assert.equal(t.at(-1).due, '2026-12-01');
  assert.ok(t.some((x) => x.late));
  assert.ok(t.every((x) => x.due >= TODAY));
});

test('buildTimeline flags nothing late when there is plenty of time', () => {
  assert.ok(buildTimeline('birthday', '2027-06-01', TODAY).every((x) => !x.late));
});

test('buildTimeline on event day puts every task today and flags all but the day itself', () => {
  const t = buildTimeline('community', TODAY, TODAY);
  assert.ok(t.every((x) => x.due === TODAY));
  assert.equal(t.filter((x) => !x.late).length, 1);
});

test('checklist scales with guest count', () => {
  assert.ok(buildChecklist('birthday', 20).some((c) => c.label.includes('20')));
  assert.ok(buildChecklist('community', 300).some((c) => c.label.includes('crowd')));
  assert.ok(!buildChecklist('community', 150).some((c) => c.label.includes('crowd')), '150 is the threshold');
  assert.ok(buildChecklist('community', 151).some((c) => c.label.includes('crowd')));
  assert.ok(buildChecklist('wedding', 10).every((c) => c.done === false));
});

test('ideas include theme when given and never mutate shared data', () => {
  assert.ok(buildIdeas('birthday', 'Space')[0].includes('Space'));
  const plain = buildIdeas('birthday', '');
  assert.equal(plain.length, 3);
  plain.push('extra');
  assert.equal(EVENT_TYPES.birthday.ideas.length, 3);
});

test('buildPlan assembles every section and per-guest cost', () => {
  const plan = buildPlan(valid().value, TODAY);
  assert.equal(plan.perGuest, Math.floor(500000 / 120));
  for (const key of ['input', 'budget', 'timeline', 'checklist', 'ideas', 'evaluation']) assert.ok(plan[key], key);
});

test('evaluatePlan returns an actionable readiness score', () => {
  const input = valid().value;
  const evaluation = evaluatePlan(input, TODAY);
  assert.ok(evaluation.score >= 0 && evaluation.score <= 100);
  assert.equal(evaluation.daysToEvent, 131);
  assert.ok(Array.isArray(evaluation.reasons));
  assert.equal(buildPlan(input, TODAY).evaluation.score, evaluation.score);
});

test('evaluatePlan awards the maximum for an ideal plan', () => {
  const e = evaluatePlan({ type: 'birthday', guests: 50, budget: 100000, date: '2027-06-01', theme: 'Space' }, TODAY);
  assert.equal(e.score, 100);
  assert.deepEqual(e.reasons, []);
});

test('evaluatePlan lead-time tiers (birthday, 10 guests, big budget, themed)', () => {
  const base = { type: 'birthday', guests: 10, budget: 100000, theme: 'x' };
  const score = (date) => evaluatePlan({ ...base, date }, TODAY).score;
  // base 25 + theme 10 + budget 15 + size 10 = 60, plus lead-time and late-task points:
  assert.equal(score('2027-02-01'), 100); // 103 days: lead 20, no late tasks 20
  assert.equal(score('2026-12-20'), 95); //  60 days: lead 15, no late tasks 20
  assert.equal(score('2026-11-19'), 80); //  29 days: lead 10, two late tasks 10
  assert.equal(score('2026-10-25'), 65); //   4 days: lead 5, five late tasks 0
});

test('evaluatePlan gives advice for each weakness', () => {
  const e = evaluatePlan({ type: 'community', guests: 800, budget: 1000, date: '2026-10-25', theme: '' }, TODAY);
  const text = e.reasons.join(' ');
  for (const phrase of ['theme', 'budget per guest', 'already due', 'crowd-management', 'less than 30 days']) {
    assert.ok(text.includes(phrase), phrase);
  }
  assert.ok(e.score < 60);
});

test('evaluatePlan mid-range budget earns points without a warning', () => {
  const mid = evaluatePlan({ type: 'birthday', guests: 100, budget: 60000, date: '2027-06-01', theme: 'x' }, TODAY);
  assert.equal(mid.score, 95);
  assert.ok(!mid.reasons.some((r) => r.includes('budget')));
});

test('evaluatePlan explains each independent readiness weakness', () => {
  const noTheme = evaluatePlan({ type: 'birthday', guests: 10, budget: 100000, date: '2027-06-01', theme: '' }, TODAY);
  assert.ok(noTheme.reasons.some((reason) => reason.includes('theme')));

  const lowBudget = evaluatePlan({ type: 'birthday', guests: 100, budget: 100, date: '2027-06-01', theme: 'x' }, TODAY);
  assert.ok(lowBudget.reasons.some((reason) => reason.includes('budget per guest')));

  const largeEvent = evaluatePlan({ type: 'birthday', guests: 501, budget: 100000, date: '2027-06-01', theme: 'x' }, TODAY);
  assert.ok(largeEvent.reasons.some((reason) => reason.includes('Large events')));
});

test('evaluatePlan counts one late task as partial credit', () => {
  // Community events start 10 weeks (70 days) out, so 65 days leaves exactly one task late.
  const e = evaluatePlan({ type: 'community', guests: 10, budget: 100000, date: '2026-12-25', theme: 'x' }, TODAY);
  assert.equal(e.lateTasks, 1);
  assert.equal(e.score, 85); // 25 + lead 15 + theme 10 + budget 15 + late 10 + size 10
});

test('scoreTitle bands', () => {
  assert.equal(scoreTitle(100), 'You are in great shape');
  assert.equal(scoreTitle(80), 'You are in great shape');
  assert.equal(scoreTitle(79), 'A solid start');
  assert.equal(scoreTitle(60), 'A solid start');
  assert.equal(scoreTitle(59), 'A few priorities need attention');
});
