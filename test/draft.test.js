import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, STORAGE_KEY, loadDraft, pickDraft, saveDraft } from '../src/draft.js';

const memoryStorage = () => {
  const store = new Map();
  return { store, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } };
};

test('pickDraft keeps only known string fields', () => {
  const draft = pickDraft({ type: 'wedding', guests: 5, theme: 'x', apikey: 'secret', evil: '1' });
  assert.deepEqual(draft, { type: 'wedding', theme: 'x' });
  assert.deepEqual(pickDraft(null), {});
  assert.deepEqual(pickDraft('text'), {});
});

test('saveDraft never persists the API key', () => {
  const storage = memoryStorage();
  assert.equal(saveDraft(storage, { type: 'wedding', apikey: 'secret' }), true);
  assert.ok(!storage.store.get(STORAGE_KEY).includes('secret'));
});

test('draft round-trips through storage', () => {
  const storage = memoryStorage();
  const data = Object.fromEntries(FIELDS.map((f) => [f, `${f}-value`]));
  saveDraft(storage, data);
  assert.deepEqual(loadDraft(storage), data);
});

test('loadDraft returns null for empty, corrupt or unusable storage', () => {
  assert.equal(loadDraft(memoryStorage()), null);
  assert.equal(loadDraft({ getItem: () => '{not json' }), null);
  assert.equal(loadDraft({ getItem: () => '[]' }), null);
  assert.equal(loadDraft({ getItem: () => { throw new Error('blocked'); } }), null);
});

test('saveDraft reports failure when storage is unavailable', () => {
  assert.equal(saveDraft({ setItem: () => { throw new Error('quota'); } }, { type: 'wedding' }), false);
});
