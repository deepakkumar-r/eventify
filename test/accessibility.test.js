// Static accessibility and security checks run against the real HTML and CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const idsOf = (source) => [...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const tags = (name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => m[0]);
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

// --- WCAG contrast maths -------------------------------------------------
const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const expandHex = (hex) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex);
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], expandHex(m[2])]));
const lightTokens = tokens(css.slice(0, css.indexOf('@media')));
const darkTokens = { ...lightTokens, ...tokens(css.match(/prefers-color-scheme: dark\) \{([^}]*)\}/)[1]) };

const PAIRS = [
  ['fg', 'bg'], ['fg', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-soft'],
  ['muted', 'accent-soft'], ['accent', 'bg'], ['accent', 'surface'], ['accent-dark', 'accent-soft'],
  ['accent-dark', 'bg'], ['on-accent', 'accent'], ['on-accent', 'accent-dark'], ['err', 'surface'], ['placeholder', 'surface'],
];

for (const [mode, t] of [['light', lightTokens], ['dark', darkTokens]]) {
  test(`text colours meet WCAG AA 4.5:1 in ${mode} mode`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(t[fg] && t[bg], `${fg}/${bg} defined`);
      const ratio = contrast(t[fg], t[bg]);
      assert.ok(ratio >= 4.5, `${mode} ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  });

  test(`form control borders meet 3:1 non-text contrast in ${mode} mode`, () => {
    assert.ok(contrast(t['control-border'], t.surface) >= 3);
  });
}

// --- Structure ------------------------------------------------------------
test('document has language, title, viewport and landmarks', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /name="viewport"/);
  for (const landmark of ['<header', '<main', '<footer']) assert.ok(html.includes(landmark), landmark);
});

test('ids are unique', () => {
  const ids = idsOf(html);
  assert.equal(new Set(ids).size, ids.length);
});

test('every form control has a visible label', () => {
  const ids = new Set(idsOf(html));
  const labelled = new Set([...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]));
  for (const tag of [...tags('input'), ...tags('select')]) {
    const id = attr(tag, 'id');
    assert.ok(id && ids.has(id) && labelled.has(id), `control ${id} needs a <label for>`);
  }
});

test('aria-describedby and skip link targets exist', () => {
  const ids = new Set(idsOf(html));
  for (const [, value] of html.matchAll(/aria-describedby="([^"]+)"/g)) {
    for (const id of value.split(/\s+/)) assert.ok(ids.has(id), `missing #${id}`);
  }
  assert.ok(ids.has(attr(html.match(/<a class="skip"[^>]*>/)[0], 'href').slice(1)));
});

test('error messages are announced and fieldset has a legend', () => {
  const errors = [...html.matchAll(/<p class="error"[^>]*>/g)].map((m) => m[0]);
  assert.equal(errors.length, 5);
  assert.ok(errors.every((tag) => tag.includes('role="alert"')));
  assert.match(html, /<fieldset>\s*<legend/);
});

test('landmark-less groups carry a role and status uses a live region', () => {
  for (const tag of html.match(/<div[^>]*aria-label="[^"]*"[^>]*>/g)) assert.ok(/role="/.test(tag), tag);
  assert.match(html, /id="status" role="status" aria-live="polite"/);
});

test('heading levels never skip', () => {
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  levels.reduce((prev, level) => {
    assert.ok(level <= prev + 1, `h${prev} -> h${level}`);
    return Math.max(prev, level);
  }, 0);
  assert.equal(levels.filter((l) => l === 1).length, 1);
});

test('tables have captions and scoped headers', () => {
  assert.match(html, /<caption/);
  assert.ok(tags('th').every((tag) => tag.includes('scope=')));
});

// --- CSS accessibility ------------------------------------------------------
test('CSS honours reduced motion, forced colours and keeps a visible focus ring', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /:focus-visible \{ outline: 3px/);
  assert.ok(!/input:focus[^{]*\{[^}]*outline:\s*none/.test(css), 'inputs must not remove the focus outline');
});

test('interactive targets are at least 24px (WCAG 2.2 target size)', () => {
  assert.match(css, /input, select, button \{ min-height: 3\.1rem/);
  assert.match(css, /\.plain input\[type="checkbox"\] \{[^}]*width: 1\.5rem; min-height: 1\.5rem/);
});

// --- Security ---------------------------------------------------------------
test('CSP forbids inline script and unknown origins', () => {
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(csp.includes("default-src 'none'"));
  assert.ok(csp.includes("script-src 'self'"));
  assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
  assert.ok(csp.includes('connect-src https://generativelanguage.googleapis.com'));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'no inline scripts');
  assert.ok(!/\son\w+=/.test(html), 'no inline event handlers');
});

test('API key field is a password input that is never autofilled', () => {
  const tag = tags('input').find((t) => attr(t, 'id') === 'apikey');
  assert.equal(attr(tag, 'type'), 'password');
  assert.equal(attr(tag, 'autocomplete'), 'off');
});

test('numeric controls expose the same limits enforced by the planner', () => {
  const guests = tags('input').find((tag) => attr(tag, 'id') === 'guests');
  const budget = tags('input').find((tag) => attr(tag, 'id') === 'budget');
  assert.equal(attr(guests, 'max'), '5000');
  assert.equal(attr(budget, 'max'), '1000000000');
});
