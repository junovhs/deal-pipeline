// =============================================================================
// JEV MATCHING — DEC-07
// TypeSafe's Jev decides which website deal (if any) each incoming deal is,
// taught the operator's rules. Code owns the facts: parsing, the ending-today
// exclusion, year-typo fixes, and the live-vs-update check on stated terms.
// =============================================================================

import { compareMarkers, dateFmt, runFullMatch } from './dedupe.js';

/** The operator's rules for "is this the same deal?", as Jev is taught them. */
export const RULES = [
  'An exclusive deal and a non-exclusive (public) deal are never the same deal. Covert, hidden, opaque, unpublished or private fares count as exclusive.',
  'Same supplier, same exclusivity and the same kind of offer means the same deal even when the dollar amount, percentage or expiry date changed. That is an update, not a new deal.',
  'An incoming deal marked Ongoing matches a website deal with an end date: the website end date was only set so the listing would not run forever. That is an update.',
  "If the incoming deal shares any part of a website deal's offer and adds more on top (extra credit, a percentage, savings, an upgrade, an expiry), it is the same deal and an update. The website deal only needs to be contained in the incoming deal, not equal to it.",
  'A website deal that is vague ("special savings", "reduced single supplements", "all-inclusive upgrade") matches an incoming deal that states the concrete version of the same thing ("save 50% on the single supplement", "comp all-inclusive package"). Single supplement savings and solo traveler savings are the same kind of offer.',
  'Website titles are marketing rewrites of the incoming text: "Receive up to $350 Onboard Credit" and "up to $350 OBC" say the same thing. OBC means onboard credit; PPG means prepaid gratuities.',
  'Already live means a website deal says the same thing with the same amounts, percentages and end date.',
  'A different kind of offer from the same supplier (for example onboard credit vs a fare discount vs a gift vs kids sail free) is a different deal.',
];

/** Worked examples from the operator's own calls. */
export const EXAMPLES = [
  { incoming: 'EXCLUSIVE up to $250 OBC: Ends 11/18/2026', website: 'EXCLUSIVE: Receive Up to $350 Onboard Credit on Your Next Cruise (ends 11/18/2026)', answer: 'update: same deal, the amount changed' },
  { incoming: 'Last Minute Deals - Save 15% with promo code LASTMINUTE. Ongoing promotion.', website: 'Save 15% on Select Last Minute Deals and Guided Vacations (ends 10/31/2026)', answer: 'update: same deal, push the website end date' },
  { incoming: 'Up to $1250 Savings: Ends 11/7/2026', website: 'EXCLUSIVE: Hidden Fares Featuring Up To 50% Savings', answer: 'new: a public deal is never the same as an exclusive one' },
  { incoming: '2028 Europe 5% Savings, Up to $200 OBC & Comp All-Inclusive Pkg', website: 'Get an All-Inclusive Upgrade', answer: 'update: the incoming deal keeps the all-inclusive offer and adds more' },
  { incoming: 'Save 50% on the Single Supplement on Private Jet Journeys', website: 'Enjoy Special Solo Savings on Select Small Group Journeys (no end date)', answer: 'update: same solo / single supplement savings, now with a committed percentage and an end date' },
];

const STATUS = {
  live: 'Already live: one of the website deals is this exact deal with the same terms and end date. Nothing to do.',
  update: 'Update: one of the website deals is the same deal, but its amount, percentage, terms or end date need changing to match the incoming deal.',
  new: 'New: none of the website deals is this deal.',
};

const ends = (date) => (date ? dateFmt.format(date) : 'no end date');

/** One Jev request for one incoming deal against its supplier's website deals. */
export function buildJevRequest(hq, webGroup, today = new Date()) {
  const websiteDeals = Object.fromEntries(webGroup.map((w, i) => [`w${i + 1}`, {
    title: w.raw?.title || '',
    description: w.raw?.shopListing || '',
    ends: ends(w.expiryDate),
    exclusive: !!w.markers?.exclusive,
  }]));
  const match = Object.fromEntries(Object.entries(websiteDeals).map(([id, w]) => [id, `${w.title} (ends ${w.ends})`]));
  match.none = 'None of the website deals is this deal.';
  // One yes/no per website deal: does the incoming deal offer anything that
  // entry does not mention? Catches extras the term parser cannot name.
  const adds = Object.fromEntries(Object.entries(websiteDeals).map(([id, w]) => [`adds_${id}`, {
    type: 'noul',
    instructions: {
      website_deal: w,
      question: 'Does `incoming_deal` offer something (a benefit, amount, percentage or perk) that `website_deal` does not mention? Rewording, marketing phrasing, end dates, promo or booking codes (like PWD, BC100, LASTMINUTE) and which sailings or tours qualify do not count.',
    },
  }]));
  return {
    state: {
      today: dateFmt.format(today),
      supplier: hq.vendor,
      incoming_deal: { text: hq.text, exclusive: !!hq.markers?.exclusive, ends: hq.ongoing ? 'ongoing' : ends(hq.end) },
      website_deals: websiteDeals,
      rules: RULES,
      examples: EXAMPLES,
    },
    questions: {
      status: {
        type: 'choice',
        instructions: "Following `rules`, what should happen to `incoming_deal` given the supplier's `website_deals`?",
        criteria: STATUS,
      },
      match: {
        type: 'choice',
        instructions: 'Following `rules`, which of `website_deals` is the same deal as `incoming_deal`?',
        criteria: match,
      },
      ...adds,
    },
  };
}

const FIGURE_KEYS = ['dollars', 'percents', 'nights', 'expiry'];

/**
 * Turns Jev's two answers into a comparison result. Jev decides whether the
 * deal is on the site and which entry it is; when Jev says update/live but
 * names no entry, the likeliest entry is used. A matched deal is live only
 * when its stated terms are all equal and Jev sees nothing extra offered.
 */
export function combineJevAnswer(hq, webGroup, answers) {
  const status = answers.status;
  const match = answers.match;
  let target = match.choice === 'none' ? -1 : Number(String(match.choice).slice(1)) - 1;
  let confidence = Math.min(status.confidence ?? 0, match.confidence ?? 0);
  if (status.choice !== 'new' && !(target >= 0 && target < webGroup.length)) {
    const ranked = Object.entries(match.probabilities || {})
      .filter(([id]) => id !== 'none')
      .sort((a, b) => b[1] - a[1]);
    target = ranked.length ? Number(ranked[0][0].slice(1)) - 1 : -1;
    confidence = Math.min(confidence, ranked[0]?.[1] ?? 0);
  }
  if (status.choice === 'new' || target < 0 || target >= webGroup.length) {
    return { hq, web: null, meta: { verdict: 'new', confidence: status.confidence ?? 0, source: 'jev', changes: [], candidates: webGroup } };
  }
  const web = webGroup[target];
  const pair = compareMarkers(hq, web);
  const termsEqual = FIGURE_KEYS.every(k => !pair.differences.includes(k)) && !pair.differences.includes('exclusive');
  const addsMore = (answers[`adds_w${target + 1}`]?.noul ?? 0) >= 0.5;
  const verdict = termsEqual && !addsMore && (pair.identical || status.choice === 'live') ? 'on-site' : 'update';
  return { hq, web, meta: { ...pair, verdict, guess: false, confidence, source: 'jev', jevStatus: status.choice, candidates: webGroup } };
}

async function pool(items, size, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await work(queue.shift());
  }));
}

/**
 * Compares every incoming deal with Jev. `call(body)` sends one request and
 * resolves to Jev's `answers`. Deals whose supplier has nothing on the site,
 * and deals Jev could not answer, keep the rule-based verdict (the latter
 * marked `jevError`). `cache` maps hq id → answers already received.
 */
export async function compareWithJev(hqDeals, websiteDeals, call, { today = new Date(), cache = {}, concurrency = 6, onProgress = (_done, _total) => {} } = {}) {
  const ruleResults = runFullMatch(hqDeals, websiteDeals);
  const byFamily = {};
  for (const w of websiteDeals) (byFamily[w.vendorFamily] ||= []).push(w);
  const answers = { ...cache };
  const todo = hqDeals.filter(hq => byFamily[hq.vendorFamily]?.length && !answers[hq.id]);
  let done = hqDeals.length - todo.length;
  onProgress(done, hqDeals.length);
  await pool(todo, concurrency, async (hq) => {
    try {
      answers[hq.id] = await call(buildJevRequest(hq, byFamily[hq.vendorFamily], today));
    } catch {
      // Left unanswered: the rule-based verdict stands for this deal.
    }
    onProgress(++done, hqDeals.length);
  });
  return { answers, results: applyJevAnswers(ruleResults, websiteDeals, answers) };
}

/** Re-applies stored Jev answers to rule-based results (no network). */
export function applyJevAnswers(ruleResults, websiteDeals, answers) {
  const byFamily = {};
  for (const w of websiteDeals) (byFamily[w.vendorFamily] ||= []).push(w);
  return ruleResults.map((result) => {
    const group = byFamily[result.hq.vendorFamily];
    if (!group?.length) return result;
    const got = answers[result.hq.id];
    if (!got?.status || !got?.match) return { ...result, meta: { ...result.meta, jevError: true, candidates: group } };
    return combineJevAnswer(result.hq, group, got);
  });
}

/**
 * Applies the operator's review: `decisions` maps hq id → { verdict, web },
 * where `web` indexes `websiteDeals`. The operator's call always wins.
 */
export function applyDecisions(results, decisions, websiteDeals) {
  return results.map((r) => {
    const d = decisions[r.hq.id];
    if (!d) return r;
    const web = d.verdict === 'new' ? null : (d.web != null ? websiteDeals[d.web] : r.web);
    if (d.verdict !== 'new' && !web) return r;
    const pair = web ? compareMarkers(r.hq, web) : { changes: [] };
    return { ...r, web, meta: { ...r.meta, ...pair, verdict: d.verdict, reviewed: true } };
  });
}
