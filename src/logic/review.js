import { sameDay } from './dedupe.js';

// A score proposes identity; only the operator can confirm unchanged copy.
export function buildReviewQueue(categorized, decisions = {}) {
  if (!categorized) return { review: [], changes: [], unchanged: [], newDeals: [], excluded: [] };
  const queue = { review: [], changes: [], unchanged: [], newDeals: [], excluded: categorized.excluded };
  for (const row of [...categorized.matched, ...categorized.extensions, ...categorized.unmatched]) {
    const decision = decisions[row.hq.id];
    if (decision === 'new') queue.newDeals.push(row);
    else if (decision === 'change') queue.changes.push(row);
    else if (decision === 'unchanged') queue.unchanged.push(row);
    else if (categorized.unmatched.includes(row)) queue.newDeals.push(row);
    else queue.review.push(row);
  }
  queue.review.sort((a, b) => (a.meta?.score ?? 0) - (b.meta?.score ?? 0));
  return queue;
}

export function dateChange(row) {
  if (row.hq.ongoing && row.web?.expiryDate) return 'Source is ongoing; website has an end date.';
  if (row.hq.end && !row.web?.expiryDate) return 'Source has an end date; website has none.';
  if (row.hq.end && row.web?.expiryDate && !sameDay(row.hq.end, row.web.expiryDate)) return 'End date differs — check the website date.';
  return '';
}
