// Offline checks for how Jev's answers become verdicts (DEC-07). No network.
import assert from 'node:assert/strict';
import { parseHQ, resetIds, ingestWebsiteJSON, categorizeDedupeResults } from '../src/logic/dedupe.js';
import { buildJevRequest, compareWithJev } from '../src/logic/jev.js';

const today = new Date(2026, 9, 13);
const choice = (c, confidence = 0.9, probabilities = {}) => ({ type: 'choice', choice: c, confidence, probabilities });
const site = (vendor, rows) => ingestWebsiteJSON(rows.map(([title, expiryDate = null, shopListing = '']) => ({ shopOverline: vendor, title, shopListing, expiryDate })));
async function run(source, web, answers, tag = 'd', vendor = 'Cunard') {
  resetIds();
  const hq = parseHQ(`v\t${vendor}\n${tag}\t${source}`);
  return (await compareWithJev(hq, site(vendor, web), async () => answers, { today })).results[0];
}

// The request names every website deal and asks one "adds anything?" per deal.
resetIds();
const req = buildJevRequest(parseHQ('v\tCunard\nd\tUp to $250 OBC: Ends 11/18/2026')[0], site('Cunard', [['A'], ['B']]), today);
assert.deepEqual(Object.keys(req.questions), ['status', 'match', 'adds_w1', 'adds_w2']);
assert.deepEqual(Object.keys(req.questions.match.criteria), ['w1', 'w2', 'none']);
assert.ok(req.state.rules.length >= 5 && req.state.examples.length >= 5, 'Jev is taught the operator rules and examples');

// Update: Jev picks the entry; changes are spelled out from the parsed terms.
const upd = await run('Up to $250 OBC: Ends 11/18/2026', [['Save 40%'], ['Receive Up to $350 Onboard Credit', '2026-11-18T08:00:00Z']],
  { status: choice('update'), match: choice('w2'), adds_w2: { noul: 0.1 } });
assert.equal(upd.meta.verdict, 'update');
assert.equal(upd.web.raw.title, 'Receive Up to $350 Onboard Credit');
assert.ok(upd.meta.changes.includes('Amount $350 → $250'));

// Equal terms and nothing extra: live, even if Jev leaned "update".
const live = await run('Up to $350 OBC: Ends 11/18/2026', [['Receive Up to $350 Onboard Credit', '2026-11-18T08:00:00Z']],
  { status: choice('update'), match: choice('w1'), adds_w1: { noul: 0.2 } });
assert.equal(live.meta.verdict, 'on-site');

// Equal parsed terms but Jev sees an extra offer: update, not live.
const extra = await run('2-for-1 Fares + Up to $350 OBC: Ends 11/18/2026', [['Receive Up to $350 Onboard Credit', '2026-11-18T08:00:00Z']],
  { status: choice('live'), match: choice('w1'), adds_w1: { noul: 0.9 } });
assert.equal(extra.meta.verdict, 'update');

// Status says update but match says none: take the likeliest entry.
const noMatch = await run('Up to $250 OBC', [['Save 40%'], ['Receive Up to $350 Onboard Credit']],
  { status: choice('update', 0.8), match: choice('none', 0.5, { w1: 0.1, w2: 0.4, none: 0.5 }), adds_w2: { noul: 0.1 } });
assert.equal(noMatch.web.raw.title, 'Receive Up to $350 Onboard Credit');
assert.ok(noMatch.meta.confidence <= 0.4, 'A rescued match is reported as unsure');

// New: no website entry.
const fresh = await run('Kids Sail Free', [['Receive Up to $350 Onboard Credit']], { status: choice('new'), match: choice('none') });
assert.equal(fresh.web, null);
assert.equal(fresh.meta.verdict, 'new');

// Jev failing keeps the rule-based verdict, marked so the UI can say so.
resetIds();
const hq = parseHQ('v\tCunard\nd\tUp to $250 OBC: Ends 11/18/2026');
const failed = (await compareWithJev(hq, site('Cunard', [['Receive Up to $350 Onboard Credit', '2026-11-18T08:00:00Z']]), async () => { throw new Error('down'); }, { today })).results[0];
assert.equal(failed.meta.jevError, true);
assert.equal(failed.meta.verdict, 'update');

// A supplier with nothing on the site is never sent to Jev.
let calls = 0;
resetIds();
await compareWithJev(parseHQ('v\tCarnival\nd\tSave 20%'), site('Cunard', [['X']]), async () => { calls++; return {}; }, { today });
assert.equal(calls, 0);

// Ending today is still excluded whatever Jev says.
const endsToday = await run('Up to $250 OBC: Ends 10/13/2026', [['Receive Up to $350 Onboard Credit']], { status: choice('update'), match: choice('w1') });
assert.equal(categorizeDedupeResults([endsToday], { today }).excluded.length, 1);

console.log('Jev answer handling (offline): PASS');
