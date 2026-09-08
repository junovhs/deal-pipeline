import assert from 'node:assert/strict';
import { buildReviewQueue, dateChange } from '../src/logic/review.js';
import { categorizeDedupeResults, exportUnmatched } from '../src/logic/dedupe.js';
import { validateDeal } from '../src/logic/copywriting.js';

const rows = [
  { hq: { id: 1, vendor: 'Carnival', text: 'Save 20%', end: new Date(2026, 9, 10) }, web: { expiryDate: new Date(2026, 9, 1) }, meta: { score: 20, isExtension: true } },
  { hq: { id: 2, vendor: 'Carnival', text: 'Free drinks' }, web: {}, meta: { score: 0 } },
  { hq: { id: 3, vendor: 'Carnival', text: 'New offer' }, web: null, meta: { score: 0 } },
];
const categories = categorizeDedupeResults(rows, { threshold: 0 });
let queue = buildReviewQueue(categories);
assert.deepEqual(queue.review.map(r => r.hq.id), [2, 1], 'Zero-score candidates and extensions require review, weakest first');
assert.equal(queue.newDeals.length, 1);
queue = buildReviewQueue(categories, { 1: 'change', 2: 'unchanged' });
assert.equal(queue.review.length, 0);
const payload = exportUnmatched([...queue.changes, ...queue.newDeals].map(r => r.hq));
assert.ok(payload.includes('Save 20%'));
assert.ok(payload.includes('New offer'));
assert.ok(!payload.includes('Free drinks'), 'Confirmed unchanged deals must never enter the copy payload');
assert.equal(queue.changes.length + queue.newDeals.length + queue.unchanged.length, rows.length);
assert.equal(buildReviewQueue(categories, { 1: 'change', 2: 'new' }).newDeals.length, 2, 'Rejected identity returns to new deals');
assert.equal(buildReviewQueue(categories, { 1: 'change' }).review[0].hq.id, 2, 'Undo restores review');
assert.ok(dateChange(rows[0]));
assert.equal(dateChange({ ...rows[0], web: { expiryDate: rows[0].hq.end } }), '');

const source = { originalText: 'Save 20% on your cruise', isExclusive: false };
const clean = { headline: 'Save 20% on your cruise', description: 'Enjoy your next cruise for less.' };
assert.equal(validateDeal(clean, source).length, 0, 'Ordinary clean copy stays quiet');
assert.ok(validateDeal({ ...clean, headline: ' ' }, source).some(w => w.ruleId === 'COPY.REQUIRED_FIELD'));
assert.ok(validateDeal({ ...clean, endDate: '2/30/27' }, source).some(w => w.ruleId === 'COPY.INVALID_DATE'));
assert.ok(validateDeal({ ...clean, startDate: '10/10/26', endDate: '10/1/26' }, source).some(w => w.ruleId === 'COPY.DATE_ORDER'));
assert.ok(!validateDeal({ ...clean, endDate: '2/29/28' }, source).some(w => w.ruleId === 'COPY.INVALID_DATE'));
console.log('Operator review, copy routing, undo, and precise lint checks: PASS');
