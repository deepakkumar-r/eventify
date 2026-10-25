import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, validateInput } from '../src/planner.js';
import { progressText, renderPlan, showErrors } from '../src/view.js';
import { createFakeDocument } from './helpers/fake-dom.js';

const TODAY = '2026-10-21';
const planFor = (overrides = {}) => buildPlan(validateInput({ type: 'wedding', guests: '120', budget: '500000', date: '2026-12-01', theme: 'Rustic', ...overrides }, TODAY).value, TODAY);

test('renderPlan fills every section and reveals the results', () => {
  const doc = createFakeDocument();
  const plan = planFor();
  doc.getElementById('results').hidden = true;
  renderPlan(doc, plan);
  const $ = (id) => doc.getElementById(id);
  assert.equal($('results').hidden, false);
  assert.equal($('plan-score').textContent, plan.evaluation.score);
  assert.equal($('budget-body').children.length, plan.budget.length);
  assert.equal($('timeline').children.length, plan.timeline.length);
  assert.equal($('checklist').children.length, plan.checklist.length);
  assert.equal($('ideas').children.length, plan.ideas.length);
  assert.match($('summary').textContent, /120 guests/);
  assert.match($('score-detail').textContent, /days until the event/);
});

test('renderPlan builds accessible table rows and labelled checkboxes', () => {
  const doc = createFakeDocument();
  renderPlan(doc, planFor());
  const [firstRow] = doc.getElementById('budget-body').children;
  assert.equal(firstRow.children[0].tag, 'th');
  assert.equal(firstRow.children[0].scope, 'row');
  const [item] = doc.getElementById('checklist').children;
  const [box, label] = item.children;
  assert.equal(box.type, 'checkbox');
  assert.equal(label.htmlFor, box.id);
  assert.equal(new Set(doc.getElementById('checklist').children.map((li) => li.children[0].id)).size, doc.getElementById('checklist').children.length);
});

test('renderPlan marks late tasks and uses singular/plural correctly', () => {
  const doc = createFakeDocument();
  renderPlan(doc, planFor());
  assert.ok(doc.getElementById('timeline').children.some((li) => li.textContent.includes('behind schedule')));
  renderPlan(doc, planFor({ type: 'birthday', date: '2027-09-01' }));
  assert.match(doc.getElementById('score-detail').textContent, /0 timeline tasks behind/);
  renderPlan(doc, planFor({ type: 'community', date: '2026-12-25' }));
  assert.match(doc.getElementById('score-detail').textContent, /1 timeline task behind/);
});

test('renderPlan treats plan text as text, not markup', () => {
  const doc = createFakeDocument();
  const plan = planFor();
  plan.ideas = ['<img src=x onerror=alert(1)>'];
  renderPlan(doc, plan);
  const [idea] = doc.getElementById('ideas').children;
  assert.equal(idea.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(idea.children.length, 0);
});

test('showErrors sets and clears messages and aria-invalid', () => {
  const doc = createFakeDocument();
  showErrors(doc, { guests: 'Too many.' });
  assert.equal(doc.getElementById('guests-error').textContent, 'Too many.');
  assert.equal(doc.getElementById('guests').getAttribute('aria-invalid'), 'true');
  assert.equal(doc.getElementById('budget').getAttribute('aria-invalid'), null);
  showErrors(doc, {});
  assert.equal(doc.getElementById('guests-error').textContent, '');
  assert.equal(doc.getElementById('guests').getAttribute('aria-invalid'), null);
});

test('progressText counts filled fields and ignores blanks', () => {
  const doc = createFakeDocument();
  assert.equal(progressText(doc), '0/5 complete');
  doc.getElementById('type').value = 'wedding';
  doc.getElementById('guests').value = '  ';
  doc.getElementById('budget').value = '100';
  assert.equal(progressText(doc), '2/5 complete');
});
