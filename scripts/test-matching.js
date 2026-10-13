import assert from 'node:assert/strict';
import { assignCandidateMatrix, categorizeDedupeResults, ingestWebsiteJSON, parseHQ, resetIds, runFullMatch } from '../src/logic/dedupe.js';

const assign = values => assignCandidateMatrix(values.map(row => row.map(score => ({ score }))), values.length, values[0].length);
assert.deepEqual(assign([[10, 9], [0, -100]]), [[0, 0], [1, -1]], 'A bad deal must not displace a better match');
assert.deepEqual(assign([[-2, -4]]), [[0, -1]], 'All negative candidates remain unmatched');
assert.deepEqual(assign([[0]]), [[0, -1]], 'No evidence does not imply a match');
assert.deepEqual(assign([[10, 9], [9, 1]]), [[0, 1], [1, 0]], 'Keep globally optimal positive assignments');
assert.deepEqual(assign([[10], [1]]), [[0, 0], [1, -1]], 'One website deal cannot be assigned twice');

function match(source, rows, expiryDate = null, tag = 'd') {
  resetIds();
  const web = rows.map(row => typeof row === 'string' ? { shopOverline: 'Norwegian Cruise Line', title: row, expiryDate } : { shopOverline: 'Norwegian Cruise Line', expiryDate, ...row });
  return runFullMatch(parseHQ(`v\tNorwegian Cruise Line\n${tag}\t${source}`), ingestWebsiteJSON(web))[0];
}
const status = (result, key) => result.meta.checks.find(check => check.key === key)?.status;

// Every marker agrees: pre-checked as identical.
const same = match('Free Gratuities for 2 + $100 OBC ends 06/15/26', ['Free Gratuities for 2 + $100 OBC'], '2026-06-15T07:00:00Z');
assert.equal(same.meta.identical, true);
assert.equal(status(same, 'type'), 'same');
assert.equal(status(same, 'dollars'), 'same');
assert.equal(status(same, 'expiry'), 'same');

// Extension: same offer, pushed expiry. Never identical, still shown beside its sibling.
const extended = match('Free Gratuities for 2 + $100 OBC ends 07/15/26', ['Free Gratuities for 2 + $100 OBC'], '2026-06-15T07:00:00Z');
assert.equal(extended.meta.identical, false);
assert.equal(extended.web.raw.title, 'Free Gratuities for 2 + $100 OBC');
assert.deepEqual(extended.meta.differences, ['expiry']);

// Changed terms: same kind, different amount.
const changed = match('Get $150 onboard credit ends 06/15/26', ['Get $100 onboard credit'], '2026-06-15T07:00:00Z');
assert.equal(changed.meta.identical, false);
assert.deepEqual(changed.meta.differences, ['dollars']);

// Plural abbreviations and exclusivity are recognized; the kind decides the sibling.
const ppg = match('[exclusive] TLN PPGs for 2. ends 9/30/26.', [
  'Enjoy Summer Savings of Up to $2,500 Per Stateroom',
  'EXCLUSIVE: Enjoy Free Gratuities for 2 on Your Cruise Vacation',
  'EXCLUSIVE: Receive up to $300 in Onboard Credit for Your Cruise',
], '2026-09-30T07:00:00Z', 'ed');
assert.equal(ppg.web.raw.title, 'EXCLUSIVE: Enjoy Free Gratuities for 2 on Your Cruise Vacation');
assert.equal(ppg.meta.identical, true);

// An exclusive deal and a public one are never the same deal.
const notExclusive = match('TLN $100 OBC ends 06/15/26', ['Get $100 onboard credit'], '2026-06-15T07:00:00Z', 'ed');
assert.equal(notExclusive.web, null);
assert.equal(notExclusive.meta.verdict, 'new');

// A different kind of offer is never a sibling, even with matching numbers and dates.
const differentKind = match('Get $100 onboard credit ends 06/15/26', ['Save $100 on airfare'], '2026-06-15T07:00:00Z');
assert.equal(differentKind.web, null);
assert.equal(differentKind.meta.candidateRankings[0].score, 0);

// Repeated mentions of one amount are one term; percents compare like dollars.
const repeated = match('Get $100 onboard credit ends 06/15/26', ['Get $100 onboard credit. Enjoy your $100 onboard credit.'], '2026-06-15T07:00:00Z');
assert.equal(status(repeated, 'dollars'), 'same');
const percent = match('Save 20% and get 10% onboard credit', ['Save 20% and get 10% onboard credit', 'Save 20% and get 5% onboard credit']);
assert.equal(percent.web.raw.title, 'Save 20% and get 10% onboard credit');

// Nights are a marker too.
const nights = match('7-night Alaska from $999 ends 06/15/26', ['10-night Alaska from $999'], '2026-06-15T07:00:00Z');
assert.deepEqual(nights.meta.differences, ['nights']);

// --- Operator verdicts, one case per reported screenshot ---
function pair(vendor, source, website, tag = 'd') {
  resetIds();
  return runFullMatch(parseHQ(`v\t${vendor}\n${tag}\t${source}`), ingestWebsiteJSON([{ shopOverline: vendor, ...website }]))[0];
}
const verdict = result => categorizeDedupeResults([result], { today: new Date(2026, 9, 13) });
const bucketOf = result => Object.entries(verdict(result)).find(([, rows]) => Array.isArray(rows) && rows.some(row => row.hq.id === result.hq.id))?.[0];

// Cunard: same exclusive OBC, same expiry, money changed → update the entry.
const cunard = pair('Cunard', 'EXCLUSIVE up to $250 OBC: Ends 11/18/2026', { title: 'EXCLUSIVE: Receive Up to $350 Onboard Credit on Your Next Cruise', shopListing: 'Enjoy extra spending money at sea with this exclusive onboard credit promotion. Call to speak with an agent!', expiryDate: '2026-11-18T08:00:00Z' }, 'ed');
assert.equal(cunard.meta.verdict, 'update');
assert.ok(cunard.meta.changes.includes('Amount $350 → $250'), cunard.meta.changes.join(' | '));

// CIE: incoming ongoing, site has the expiry the operator set → update (push expiry).
const cie = pair('CIE Tours', 'Last Minute Deals - Save 15% with promo code LASTMINUTE. Ongoing promotion based on availability.', { title: 'Save 15% on Select Last Minute Deals and Guided Vacations', shopListing: 'Take advantage of spontaneous travel opportunities with special discounted rates on available tour departures. Call to speak with an agent!', expiryDate: '2026-10-31T07:00:00Z' });
assert.equal(cie.meta.verdict, 'update');
assert.ok(cie.meta.changes.some(c => /^Ongoing/.test(c)));

// Carnival: 2206 is a typo for 2026 → identical, already on site.
const carnival = pair('Carnival', 'EXCLUSIVE 10% Savings (PWD): Ends 11/9/2206', { title: 'EXCLUSIVE: Receive 10% Savings on Your Next Cruise Vacation', shopListing: 'Enjoy exclusive reduced pricing across exciting itineraries for exceptional savings on your booking. Call to speak with an agent!', expiryDate: '2026-11-09T08:00:00Z' }, 'ed');
assert.equal(carnival.hq.end.getFullYear(), 2026);
assert.equal(carnival.hq.text, 'EXCLUSIVE 10% Savings (PWD): Ends 11/9/2026', 'The corrected year reaches Publish');
assert.equal(carnival.meta.verdict, 'on-site');
assert.equal(bucketOf(carnival), 'onSite');

// Avalon: public $1250 savings vs an exclusive hidden-fares deal → not the same deal.
const avalon = pair('Avalon Waterways', 'Up to $1250 Savings: Ends 11/7/2026', { title: 'EXCLUSIVE: Hidden Fares Featuring Up To 50% Savings', shopListing: 'Discover special hidden savings by calling an agent for more details on your next journey. Call to speak with an agent!' });
assert.equal(avalon.web, null);
assert.equal(bucketOf(avalon), 'added');

// A&K: same kind, incoming commits to 50% and an expiry → update.
const ak = pair('Abercrombie & Kent', 'Save 50% on the Single Supplement on 2027 Private Jet Journeys. Ends 12/31/26', { title: 'Enjoy Special Solo Savings on Select 2025 Small Group Journeys Now', shopListing: 'Solo travelers can enjoy reduced single supplements on specific small group departures throughout the year.' });
assert.equal(ak.meta.verdict, 'update');
assert.deepEqual(ak.meta.changes, ['Adds 50%', 'Adds expiry 12/31/2026']);

// Viking: public sale vs an exclusive site deal → new.
const viking = pair('Viking Ocean', 'Quiet Season Sale: Upgrades & Reduced Fares: Ends 10/31/2026', { title: 'EXCLUSIVE! Get maximum discounts & bonuses on your next Viking sailing!', shopListing: "Don't miss this deal, exclusive from TravelPerks." });
assert.equal(viking.web, null);
assert.equal(bucketOf(viking), 'added');

// Windstar: overlaps on all-inclusive and only adds terms → update.
const windstar = pair('Windstar', '2028 Europe 5% Savings, Up to $200 OBC & Comp All-Inclusive Pkg: Ends 10/31/2026', { title: 'Get an All-Inclusive Upgrade', shopListing: 'The offer features an All-Inclusive Upgrade. Call to speak with an agent!', expiryDate: '2026-11-17T08:00:00Z' });
assert.equal(windstar.meta.verdict, 'update');

// Partial overlap that contradicts a stated figure goes forward as a best guess.
const conflict = pair('Windstar', 'Up to $200 OBC & Comp All-Inclusive Pkg: Ends 10/31/2026', { title: 'Get an All-Inclusive Upgrade plus $500 savings', expiryDate: '2026-10-31T07:00:00Z' });
assert.equal(conflict.meta.verdict, 'update');
assert.equal(conflict.meta.guess, true);

// Two equally good website deals: update the best one, marked as a guess, never block.
resetIds();
const tie = runFullMatch(parseHQ('v\tCunard\nd\tUp to $250 OBC: Ends 11/18/2026'), ingestWebsiteJSON([
  { shopOverline: 'Cunard', title: 'Receive Up to $350 Onboard Credit' },
  { shopOverline: 'Cunard', title: 'Receive Up to $300 Onboard Credit' },
]))[0];
assert.equal(tie.meta.verdict, 'update');
assert.equal(tie.meta.guess, true);
assert.equal(cunard.meta.guess, false);

// Ending today is always excluded unless it is already on the site.
const endsToday = pair('Cunard', 'Up to $250 OBC: Ends 10/13/2026', { title: 'Receive Up to $350 Onboard Credit' });
assert.equal(bucketOf(endsToday), 'excluded');

console.log('Assignment, marker checklist, identical/extension/changed outcomes, operator verdicts: PASS');
