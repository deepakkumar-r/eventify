// Browser entry point: wires the form to the pure modules. Logic lives elsewhere.
import { buildPlan, validateInput } from './planner.js';
import { requestIdeas } from './ai.js';
import { formatPlanText } from './export.js';
import { FIELDS, loadDraft, saveDraft } from './draft.js';
import { progressText, renderPlan, showErrors } from './view.js';

const $ = (id) => document.getElementById(id);
const setStatus = (message) => { $('status').textContent = message; };

/** Local calendar date as YYYY-MM-DD. */
function todayIso() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The most recently generated plan; module-scoped instead of a window global. */
let currentPlan = null;

function updateProgress() {
  $('form-progress').textContent = progressText(document);
}

function onDraftInput() {
  const saved = saveDraft(localStorage, Object.fromEntries(new FormData($('planner-form'))));
  $('draft-status').textContent = saved ? 'Draft saved automatically.' : 'Draft could not be saved in this browser.';
  updateProgress();
}

function restoreDraft() {
  const draft = loadDraft(localStorage);
  if (draft) {
    for (const field of FIELDS) if (field in draft) $(field).value = draft[field];
    $('draft-status').textContent = 'Saved draft restored.';
  }
  updateProgress();
}

function downloadPlan() {
  if (!currentPlan) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([formatPlanText(currentPlan)], { type: 'text/plain' }));
  link.download = 'event-plan.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function onSubmit(event) {
  event.preventDefault();
  const today = todayIso();
  const data = Object.fromEntries(new FormData(event.target));
  const { ok, errors, value } = validateInput(data, today);
  showErrors(document, errors);
  if (!ok) {
    setStatus('Please fix the highlighted fields.');
    document.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  currentPlan = buildPlan(value, today);
  renderPlan(document, currentPlan);
  $('results-title').focus();
  setStatus('Plan ready.');
  $('ai-ideas').textContent = '';
  const apiKey = String(data.apikey ?? '').trim(); // in memory only, never stored
  if (!apiKey) return;
  setStatus('Asking AI for extra ideas...');
  try {
    $('ai-ideas').textContent = await requestIdeas({ apiKey, input: value });
    setStatus('Plan ready with AI ideas.');
  } catch {
    $('ai-ideas').textContent = 'AI ideas are unavailable right now. Your plan above is still complete.';
    setStatus('Plan ready (AI unavailable).');
  }
}

for (const field of FIELDS) $(field).addEventListener('input', onDraftInput);
$('download-plan').addEventListener('click', downloadPlan);
$('print-plan').addEventListener('click', () => window.print());
$('planner-form').addEventListener('submit', onSubmit);
$('date').min = todayIso();
restoreDraft();
