/** Plain-text export of a plan, kept pure so it can be unit-tested. */

/**
 * @param {import('./planner.js').Plan} plan
 * @returns {string}
 */
export function formatPlanText(plan) {
  const { input, evaluation } = plan;
  return [
    'CELEBRATION & EVENT PLANNER',
    `Event: ${input.type} | Date: ${input.date} | Guests: ${input.guests}`,
    `Readiness score: ${evaluation.score}/100`,
    '',
    'BUDGET',
    ...plan.budget.map((row) => `${row.category}: ${row.percent}% (${row.amount})`),
    '',
    'TIMELINE',
    ...plan.timeline.map((task) => `${task.due}: ${task.task}${task.late ? ' (behind schedule)' : ''}`),
    '',
    'VENDOR CHECKLIST',
    ...plan.checklist.map((item) => `- ${item.label}`),
    '',
    'IDEAS',
    ...plan.ideas.map((idea) => `- ${idea}`),
  ].join('\n');
}
