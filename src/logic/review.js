// The matcher decides every row it can; the operator only answers `ask` rows
// and may override any verdict. Decisions are 'on-site', 'update' or 'new'.
const BUCKET = { 'on-site': 'onSite', update: 'update', new: 'added' };

export function buildReviewQueue(categorized, decisions = {}) {
  const queue = { ask: [], update: [], added: [], onSite: [], excluded: categorized?.excluded || [] };
  if (!categorized) return queue;
  for (const key of ['ask', 'update', 'added', 'onSite']) {
    for (const row of categorized[key]) {
      const decision = decisions[row.hq.id];
      // Update needs a website deal to update; without one it stays put.
      const target = decision && !(decision === 'update' && !row.web) ? BUCKET[decision] : key;
      queue[target].push(decision ? { ...row, decided: decision } : row);
    }
  }
  const byVendor = (a, b) => a.hq.vendor.localeCompare(b.hq.vendor) || a.hq.id - b.hq.id;
  for (const key of ['ask', 'update', 'added', 'onSite']) queue[key].sort(byVendor);
  return queue;
}
