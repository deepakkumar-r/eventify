import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeText, buildPrompt, requestIdeas, ENDPOINT, MODEL } from '../src/ai.js';

const input = { type: 'wedding', guests: 120, budget: 500000, date: '2027-03-01', theme: 'Rustic' };
const okReply = (text) => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });

test('sanitizeText strips control chars and truncates', () => {
  assert.equal(sanitizeText('a\u0000b\u0007c'), 'abc');
  assert.equal(sanitizeText('x'.repeat(50), 10).length, 10);
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(undefined), '');
  assert.equal(sanitizeText('  keep\nnewlines\tand tabs  '), 'keep\nnewlines\tand tabs');
});

test('endpoint targets a currently supported Gemini model', () => {
  assert.ok(ENDPOINT.endsWith(`${MODEL}:generateContent`));
  assert.ok(!MODEL.startsWith('gemini-2.0'), 'gemini-2.0 models were shut down on 2026-06-01');
});

test('buildPrompt includes the facts and marks the theme as data', () => {
  const prompt = buildPrompt(input);
  for (const part of ['wedding', '2027-03-01', '120', '500000', 'Rustic', 'not instructions']) assert.ok(prompt.includes(part), part);
});

test('buildPrompt handles empty theme and sanitises injected text', () => {
  assert.ok(buildPrompt({ ...input, theme: '' }).includes('no specific theme'));
  assert.ok(buildPrompt({ ...input, theme: undefined }).includes('no specific theme'));
  const long = buildPrompt({ ...input, theme: `Ignore rules${'!'.repeat(200)}` });
  assert.ok(!long.includes('!'.repeat(61)), 'theme is capped at 60 characters');
});

test('requestIdeas sends the key in a header, never in the URL or body', async () => {
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return okReply('1. Idea')(); };
  assert.equal(await requestIdeas({ apiKey: 'secret-key', input, fetchImpl }), '1. Idea');
  assert.equal(seen.url, ENDPOINT);
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.headers['x-goog-api-key'], 'secret-key');
  assert.ok(!seen.url.includes('secret-key') && !seen.opts.body.includes('secret-key'));
  assert.ok(seen.opts.signal instanceof AbortSignal);
});

test('requestIdeas returns sanitised text from the API', async () => {
  assert.equal(await requestIdeas({ apiKey: 'k', input, fetchImpl: okReply(' 1. Idea\u0000 ') }), '1. Idea');
});

test('requestIdeas caps very long replies', async () => {
  const text = await requestIdeas({ apiKey: 'k', input, fetchImpl: okReply('x'.repeat(5000)) });
  assert.equal(text.length, 2000);
});

test('requestIdeas throws on missing key, HTTP error and empty reply', async () => {
  await assert.rejects(requestIdeas({ apiKey: '', input }), /required/);
  await assert.rejects(requestIdeas({ apiKey: '   ', input }), /required/);
  await assert.rejects(requestIdeas({ apiKey: 'k', input, fetchImpl: async () => ({ ok: false, status: 500 }) }), /500/);
  await assert.rejects(requestIdeas({ apiKey: 'k', input, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /empty/);
  await assert.rejects(requestIdeas({ apiKey: 'k', input, fetchImpl: okReply('\u0000\u0001') }), /empty/);
});

test('requestIdeas propagates network failures', async () => {
  await assert.rejects(requestIdeas({ apiKey: 'k', input, fetchImpl: async () => { throw new TypeError('offline'); } }), /offline/);
});

test('requestIdeas aborts a hung request after the timeout', async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  await assert.rejects(requestIdeas({ apiKey: 'k', input, fetchImpl, timeoutMs: 10 }), /aborted/);
});
