// Integration test for src/app.js: real module, fake browser globals.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDocument, createFakeStorage } from './helpers/fake-dom.js';
import { STORAGE_KEY } from '../src/draft.js';

const FIELDS = ['type', 'guests', 'budget', 'date', 'theme'];
const doc = createFakeDocument();
const storage = createFakeStorage({ [STORAGE_KEY]: JSON.stringify({ guests: '80', theme: 'Garden' }) });
let printed = 0;

// FormData double: reads the same fields the browser would submit (plus the API key).
globalThis.FormData = class {
  constructor() { this.entries = [...FIELDS, 'apikey'].map((f) => [f, doc.getElementById(f).value]); }
  [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
};
globalThis.document = doc;
globalThis.localStorage = storage;
globalThis.window = { print: () => { printed += 1; } };

const $ = (id) => doc.getElementById(id);
const fillForm = (values) => { for (const [k, v] of Object.entries(values)) $(k).value = v; };
const submit = () => $('planner-form').listeners.get('submit')({ preventDefault() { this.prevented = true; }, target: $('planner-form') });
const future = () => `${new Date().getFullYear() + 1}-06-15`;
const valid = () => ({ type: 'birthday', guests: '40', budget: '80000', date: future(), theme: 'Space', apikey: '' });
const realFetch = globalThis.fetch;

before(async () => { await import('../src/app.js'); });
beforeEach(() => { globalThis.fetch = realFetch; });

test('restores a saved draft and shows progress on load', () => {
  assert.equal($('guests').value, '80');
  assert.equal($('theme').value, 'Garden');
  assert.equal($('draft-status').textContent, 'Saved draft restored.');
  assert.equal($('form-progress').textContent, '2/5 complete');
  assert.match($('date').min, /^\d{4}-\d{2}-\d{2}$/);
});

test('typing saves a draft without the API key and updates progress', () => {
  fillForm({ ...valid(), apikey: 'secret' });
  $('theme').listeners.get('input')();
  const saved = storage.store.get(STORAGE_KEY);
  assert.ok(saved.includes('Space'));
  assert.ok(!saved.includes('secret'));
  assert.equal($('draft-status').textContent, 'Draft saved automatically.');
  assert.equal($('form-progress').textContent, '5/5 complete');
});

test('invalid submit shows errors, focuses the first bad field and builds no plan', async () => {
  fillForm({ ...valid(), guests: '0', budget: '' });
  $('results').hidden = true;
  await submit();
  assert.equal($('status').textContent, 'Please fix the highlighted fields.');
  assert.match($('guests-error').textContent, /whole number/);
  assert.match($('budget-error').textContent, /greater than 0/);
  assert.equal($('guests').getAttribute('aria-invalid'), 'true');
  assert.ok($('guests').focused);
  assert.equal($('results').hidden, true);
});

test('valid submit renders the plan, clears errors and focuses the results heading', async () => {
  fillForm(valid());
  await submit();
  assert.equal($('status').textContent, 'Plan ready.');
  assert.equal($('guests-error').textContent, '');
  assert.equal($('results').hidden, false);
  assert.ok($('results-title').focused);
  assert.ok($('timeline').children.length > 0);
  assert.equal($('ai-ideas').textContent, '');
});

test('with an API key the AI ideas are fetched and shown', async () => {
  let call;
  globalThis.fetch = async (url, opts) => { call = { url, opts }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '1. Balloons' }] } }] }) }; };
  fillForm({ ...valid(), apikey: 'abc' });
  await submit();
  assert.equal($('ai-ideas').textContent, '1. Balloons');
  assert.equal($('status').textContent, 'Plan ready with AI ideas.');
  assert.equal(call.opts.headers['x-goog-api-key'], 'abc');
});

test('AI failure falls back gracefully and keeps the plan', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  fillForm({ ...valid(), apikey: 'abc' });
  await submit();
  assert.match($('ai-ideas').textContent, /unavailable/);
  assert.equal($('status').textContent, 'Plan ready (AI unavailable).');
  assert.equal($('results').hidden, false);
});

test('download builds a text file from the current plan', () => {
  const links = [];
  const original = doc.createElement;
  doc.createElement = (tag) => { const node = original(tag); if (tag === 'a') links.push(node); return node; };
  $('download-plan').listeners.get('click')();
  doc.createElement = original;
  assert.equal(links.length, 1);
  assert.equal(links[0].download, 'event-plan.txt');
  assert.equal(links[0].clicked, 1);
});

test('print button calls window.print', () => {
  $('print-plan').listeners.get('click')();
  assert.equal(printed, 1);
});
