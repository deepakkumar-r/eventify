/** DOM rendering. Every function receives the document, so it can be tested with a fake. */
import { FIELDS } from './draft.js';
import { scoreTitle } from './planner.js';

/** Create an element; text is set via textContent so it is never parsed as HTML. */
function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const fill = (container, nodes) => container.replaceChildren(...nodes);

/**
 * Show or clear the validation message and aria-invalid flag for every field.
 * @param {Document} doc
 * @param {Record<string, string>} errors
 */
export function showErrors(doc, errors) {
  for (const field of FIELDS) {
    doc.getElementById(`${field}-error`).textContent = errors[field] ?? '';
    const input = doc.getElementById(field);
    if (errors[field]) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

/**
 * Render the whole plan and reveal the results section.
 * @param {Document} doc
 * @param {import('./planner.js').Plan} plan
 */
export function renderPlan(doc, plan) {
  const $ = (id) => doc.getElementById(id);
  const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const { evaluation } = plan;
  const plural = evaluation.lateTasks === 1 ? '' : 's';

  $('summary').textContent = `Budget ${money.format(plan.input.budget)} for ${plan.input.guests} guests (about ${money.format(plan.perGuest)} per guest).`;
  $('plan-score').textContent = evaluation.score;
  $('score-title').textContent = scoreTitle(evaluation.score);
  $('score-detail').textContent = `${evaluation.daysToEvent} days until the event · ${evaluation.lateTasks} timeline task${plural} behind`;
  fill($('score-reasons'), evaluation.reasons.map((reason) => el(doc, 'li', reason)));

  fill($('budget-body'), plan.budget.map((row) => {
    const tr = el(doc, 'tr');
    const th = el(doc, 'th', row.category);
    th.scope = 'row';
    tr.append(th, el(doc, 'td', `${row.percent}%`), el(doc, 'td', money.format(row.amount)));
    return tr;
  }));
  fill($('timeline'), plan.timeline.map((t) => el(doc, 'li', `${t.due}: ${t.task}${t.late ? ' (start now, behind schedule)' : ''}`)));
  fill($('checklist'), plan.checklist.map((item, i) => {
    const li = el(doc, 'li');
    const box = el(doc, 'input');
    box.type = 'checkbox';
    box.id = `vendor-${i}`;
    const label = el(doc, 'label', item.label);
    label.htmlFor = box.id;
    li.append(box, label);
    return li;
  }));
  fill($('ideas'), plan.ideas.map((idea) => el(doc, 'li', idea)));
  $('results').hidden = false;
}

/**
 * Count how many form fields have a value.
 * @param {Document} doc
 * @returns {string} e.g. "3/5 complete"
 */
export function progressText(doc) {
  const complete = FIELDS.filter((field) => String(doc.getElementById(field).value).trim()).length;
  return `${complete}/${FIELDS.length} complete`;
}
