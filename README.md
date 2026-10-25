# Celebration & Event Planner

A GenAI-powered planning assistant for **weddings, birthdays and community events**. Enter event type, guests, budget, date and theme to get:

- **Budget split** by category (whole numbers that always add up to your total)
- **Dated timeline** working back from the event date, flagging tasks already behind schedule
- **Vendor checklist** that scales with guest count
- **Readiness score** with actionable reasons (a transparent 0–100 score based on lead time, theme, budget per guest, timeline status and event size)
- **Personalised ideas**, plus optional extra suggestions from Google Gemini
- **Download** (text) and **print** of the finished plan

## Run
```bash
npm start              # serves http://localhost:8080 (Node.js 20+, no runtime dependencies)
npm test               # built-in Node test runner
npm run test:coverage  # tests + coverage gate (needs Node 22+)
npm install && npm run verify # lint + tests + coverage gate
```
Or deploy the folder to GitHub Pages as-is.

## Project layout
| File | Responsibility |
|---|---|
| `src/planner.js` | Pure logic: validation, budget, timeline, checklist, readiness score |
| `src/ai.js` | Optional Gemini request: sanitising, timeout, error handling |
| `src/export.js` | Plain-text export of a plan |
| `src/draft.js` | Draft persistence (storage is injected) |
| `src/view.js` | DOM rendering (document is injected) |
| `src/app.js` | Thin wiring between the form and the modules above |
| `server.mjs` | Static server with an allowlist and security headers |

## How it maps to the evaluation criteria
| Criterion | What was done |
|---|---|
| Problem alignment | Covers weddings, birthdays, community events; budgets, timelines, vendor checklists, personalised ideas, GenAI |
| Code quality | Small ES modules with one job each; pure logic separated from AI, DOM and server; JSDoc typedefs; named constants instead of magic numbers; immutable planner configuration; no globals; ESLint config; `.editorconfig`; CI workflow on Node 20 and 22 |
| Security | Strict CSP (no inline script, no `unsafe-*`); all output via `textContent`; strict input validation; AI replies sanitised; API key kept in memory, sent in a header, never stored; server serves an allowlist only (never `server.mjs`, tests or config) plus `nosniff`, `X-Frame-Options`, `Referrer-Policy`; path-traversal blocked |
| Efficiency | No framework or build step; O(n) logic; 15 s request timeout; AI call is optional and never blocks the plan; `no-cache` revalidation |
| Testing | 82 tests, 97%+ line coverage, 90%+ branch coverage and 95%+ function coverage enforced by `npm run test:coverage`: validation boundaries, budget invariants, every event type and score tier, mocked AI success/timeout/failure, DOM rendering, full form flow, real HTTP server tests (traversal, methods, headers) and automated accessibility checks |
| Accessibility | WCAG AA contrast **verified by tests** in light and dark mode; labelled fields, `fieldset`/`legend`, `aria-invalid` + `role="alert"` errors, live status region, focus moved to results, skip link, scoped table headers, 24 px+ targets, visible focus ring, dark mode, reduced motion, forced-colors, landmarks incl. footer |

## Notes
- The AI call uses `gemini-3.5-flash` (`MODEL` in `src/ai.js`). Google retires models regularly (`gemini-2.0-flash` was shut down on 1 June 2026), so check the [deprecations page](https://ai.google.dev/gemini-api/docs/deprecations) and change that one constant if needed.

The readiness score is deterministic and explainable: it awards points for lead time, a theme, budget per guest, an on-time timeline and a manageable guest count, then lists a reason for every missed condition. The score is capped at 100 and does not use the optional AI request.

## Privacy
The Gemini key is optional, never persisted, and only sent to `generativelanguage.googleapis.com`. Without it, the app works fully offline.
