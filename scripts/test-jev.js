// Live accuracy check for Jev matching (DEC-07). Needs JEV_API_KEY; not part
// of `npm test` because it calls the TypeSafe API. Runs every labelled case
// through the same code the app uses and reports accuracy per set.
import { readFileSync } from 'node:fs';
import { parseHQ, resetIds, ingestWebsiteJSON } from '../src/logic/dedupe.js';
import { compareWithJev } from '../src/logic/jev.js';

const key = process.env.JEV_API_KEY;
if (!key) { console.error('Set JEV_API_KEY to run the live Jev check.'); process.exit(2); }

const call = async (body) => {
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', ...body }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(json)}`);
  return json.answers;
};

const cases = JSON.parse(readFileSync(new URL('../fixtures/jev/labelled-cases.json', import.meta.url), 'utf8'));
const today = new Date(2026, 9, 13);
const tally = {};
await Promise.all(cases.map(async (c) => {
  resetIds();
  const hq = parseHQ(`v\t${c.supplier}\n${c.tag}\t${c.incoming}`);
  const { results } = await compareWithJev(hq, ingestWebsiteJSON(c.website), call, { today });
  const r = results[0];
  const verdict = r.web ? r.meta.verdict : 'new';
  const ok = verdict === c.expect.verdict && (c.expect.website === null || r.web?.raw?.title === c.expect.website) && !r.meta.jevError;
  (tally[c.set] ||= { pass: 0, total: 0 }).total++;
  if (ok) tally[c.set].pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${c.set}] ${c.name}: ${verdict}${r.web ? ` → ${r.web.raw.title}` : ''} (${Math.round((r.meta.confidence ?? 0) * 100)}% sure)${r.meta.jevError ? ' JEV ERROR' : ''}`);
}));
const all = Object.values(tally).reduce((a, t) => ({ pass: a.pass + t.pass, total: a.total + t.total }), { pass: 0, total: 0 });
for (const [set, t] of Object.entries(tally)) console.log(`${set}: ${t.pass}/${t.total}`);
console.log(`Jev accuracy: ${all.pass}/${all.total}`);
process.exit(all.pass === all.total ? 0 : 1);
