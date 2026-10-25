/** Form-draft persistence. Storage is injected so the logic is testable without a browser. */

export const STORAGE_KEY = 'celebration-event-planner-draft';
export const FIELDS = Object.freeze(['type', 'guests', 'budget', 'date', 'theme']);

/**
 * Keep only known string fields; the API key and anything unexpected is dropped.
 * @param {unknown} data
 * @returns {Record<string, string>}
 */
export function pickDraft(data) {
  const draft = {};
  if (data && typeof data === 'object') {
    for (const field of FIELDS) if (typeof data[field] === 'string') draft[field] = data[field];
  }
  return draft;
}

/**
 * @param {Pick<Storage, 'setItem'>} storage
 * @param {Record<string, unknown>} data
 * @returns {boolean} true when saved
 */
export function saveDraft(storage, data) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(pickDraft(data)));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Pick<Storage, 'getItem'>} storage
 * @returns {Record<string, string> | null} null when nothing usable is stored
 */
export function loadDraft(storage) {
  try {
    const draft = pickDraft(JSON.parse(storage.getItem(STORAGE_KEY) || 'null'));
    return Object.keys(draft).length ? draft : null;
  } catch {
    return null;
  }
}
