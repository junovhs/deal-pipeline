// =============================================================================
// DEDUPE LOGIC — ported from dedupe/index.html
// Bug fixes applied:
//   1. Viking familyOf ordering — fixed in shared suppliers.js
//   2. Supplier list drift — eliminated by using shared suppliers.js
//   3. parseYear — handles garbage input, returns null instead of NaN
// =============================================================================

import { norm, canonicalVendor, vendorFamily } from './suppliers.js';

// --- Date parsing ---

function parseYear(y) {
  if (!y) return null;
  // BUG FIX: Strip non-digit characters and validate
  const cleaned = y.replace(/\D/g, '');
  if (!cleaned) return null; // pure garbage like "q7"
  let n = +cleaned;
  if (isNaN(n)) return null;
  if (cleaned.length <= 2) n = n >= 70 ? 1900 + n : 2000 + n;
  return n;
}

function toLA(m, d, y) { return new Date(y, m - 1, d, 12, 0, 0); }
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export function sameDay(a, b) {
  return !!(a && b) &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function parseHQDates(text) {
  const t = text.toLowerCase();
  const out = { start: null, end: null, ongoing: false, dateWarning: null };

  if (/ongoing/.test(t)) { out.ongoing = true; return out; }
  if (/today/.test(t)) { out.end = endOfDay(new Date()); return out; }

  const range = t.match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*[-–]\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/
  );
  if (range) {
    const y2 = parseYear(range[6]);
    const y1 = parseYear(range[3] ?? range[6]);
    if (y1 === null || y2 === null) {
      out.dateWarning = `Could not parse year in date range: "${range[0]}"`;
      return out;
    }
    out.start = toLA(+range[1], +range[2], y1);
    out.end = endOfDay(toLA(+range[4], +range[5], y2));
    return out;
  }

  const single = t.match(/ends?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (single) {
    let y = parseYear(single[3]);
    if (single[3] && y === null) {
      out.dateWarning = `Possible typo in year: "${single[3]}" in "${single[0]}"`;
      return out;
    }
    if (!single[3] || y === null) {
      const tent = toLA(+single[1], +single[2], new Date().getFullYear());
      y = tent < startOfDay(new Date()) ? new Date().getFullYear() + 1 : new Date().getFullYear();
    }
    out.end = endOfDay(toLA(+single[1], +single[2], y));
    return out;
  }

  const any = [...t.matchAll(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g)];
  if (any.length) {
    const last = any[any.length - 1];
    const y = parseYear(last[3]);
    if (last[3] && y === null) {
      out.dateWarning = `Possible typo in year: "${last[3]}"`;
      return out;
    }
    out.end = endOfDay(toLA(+last[1], +last[2], y || new Date().getFullYear()));
  }
  return out;
}

// --- Feature bag extraction ---

const FEATURE_PATTERNS = [
  ["obc", /\bobc\b|on\s*board\s*credit|bar\s*tab/i],
  ["ppg", /\bppg\b|prepaid\s*gratuit|free\s*gratuit|gratuit/i],
  ["covert", /\bcovert\b|too\s*low\s*to\s*show|hidden|secret|opaque|private\s*sale|unadvertised/i],
  ["kids-free", /kids?\s*(sail|stay)\s*free/i],
  ["instant", /instant\s*(savings?|credit)/i],
  ["upgrade", /\b\d*-?\s*cat(egory)?\s*upgrade|\bupgrade\b|\bbalcony\s*upgrade/i],
  ["drinks-wifi", /(drinks?|beverage|bev\s*pkg|cheers).*wi[\s-]*fi|wi[\s-]*fi.*(drinks?|beverage)|all[\s-]*inclusive\s*pricing\s*\(drinks/i],
  ["airfare", /\bair\s*credit|\bbogo\s*air|\bair\s*fare|\bfree\s*air/i],
  ["2nd-guest", /2nd\s*guest|second\s*guest/i],
  ["dining", /specialty\s*din|free\s*din|tamarind\s*din|canaletto\s*din|dining\s*credit/i],
  ["coupon", /coupon\s*booklet|savings?\s*coupon|\bbooklet\b/i],
  ["perk", /\bperk(?:s)?\b(?!.*\bno\s*perk)/i],
  ["no-perk", /\bno\s*perk/i],
  ["deposit", /reduced\s*deposit/i],
  ["shore-ex", /shore\s*ex|shore\s*excursion/i],
  ["spa", /spa\s*credit/i],
  ["military", /military/i],
  ["resident", /resident\s*rate|florida.*resident|georgia.*resident/i],
  ["free-at-sea", /free\s*at\s*sea/i],
  ["wave", /\bwave\b/i],
  ["flash-sale", /flash\s*sale/i],
  ["early-saver", /early\s*saver/i],
  ["all-inclusive", /all[\s-]*inclusive/i],
];

function extractFeatureBag(text) {
  const features = new Set();
  for (const [tag, re] of FEATURE_PATTERNS) {
    if (re.test(text)) features.add(tag);
  }

  const dollars = [];
  for (const m of text.matchAll(/\$\s*([\d,]+)/g)) {
    const val = parseInt(m[1].replace(/,/g, ''), 10);
    if (val > 0 && val < 100000) dollars.push(val);
  }

  const percents = [];
  for (const m of text.matchAll(/(\d{1,3})\s*%/g)) {
    const val = parseInt(m[1], 10);
    if (val > 0 && val <= 100) percents.push(val);
  }

  if (/ongoing/i.test(text)) features.add("ongoing");

  return { features, dollars, percents };
}

// --- Scoring ---

const IGNORE_FEATURES = new Set(["wave", "flash-sale", "ongoing"]);

const FEATURE_WEIGHTS = {
  covert: 6, obc: 4, ppg: 4, "kids-free": 4, instant: 4,
  dining: 4, "drinks-wifi": 4, "all-inclusive": 4, airfare: 3,
  "2nd-guest": 3, upgrade: 3, coupon: 3, "no-perk": 4, perk: 3,
  deposit: 3, "shore-ex": 3, spa: 3, military: 5, resident: 5,
  "free-at-sea": 5, "early-saver": 4,
};

const TEXT_STOPS = new Set([
  "the","a","an","and","or","for","on","in","to","of","with","at","by",
  "from","up","is","are","get","your","our","all","more","plus","per",
  "off","select","now","book","receive","enjoy",
]);

function textSimilarity(a, b) {
  const tokA = new Set(norm(a).split(/\s+/).filter(w => w.length > 2 && !TEXT_STOPS.has(w)));
  const tokB = new Set(norm(b).split(/\s+/).filter(w => w.length > 2 && !TEXT_STOPS.has(w)));
  let inter = 0;
  for (const w of tokA) if (tokB.has(w)) inter++;
  const union = new Set([...tokA, ...tokB]).size;
  return union > 0 ? inter / union : 0;
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Los_Angeles'
});
export { dateFmt };

function scorePair(hq, web) {
  let score = 0;
  const why = [];
  const fH = hq.bag.features;
  const fW = web.bag.features;

  const hqFeats = new Set([...fH].filter(f => !IGNORE_FEATURES.has(f)));
  const webFeats = new Set([...fW].filter(f => !IGNORE_FEATURES.has(f)));
  const shared = new Set([...hqFeats].filter(f => webFeats.has(f)));
  const hqOnly = new Set([...hqFeats].filter(f => !webFeats.has(f)));
  const webOnly = new Set([...webFeats].filter(f => !hqFeats.has(f)));

  for (const f of shared) {
    const w = FEATURE_WEIGHTS[f] || 2;
    score += w;
    why.push({ text: f, type: 'pos' });
  }
  for (const f of hqOnly) {
    const w = FEATURE_WEIGHTS[f] || 2;
    score -= Math.ceil(w * 0.6);
    why.push({ text: '−' + f, type: 'neg' });
  }
  for (const f of webOnly) {
    const w = FEATURE_WEIGHTS[f] || 2;
    score -= Math.ceil(w * 0.4);
    why.push({ text: 'web+' + f, type: 'neg' });
  }

  if (fH.has('covert') !== fW.has('covert')) {
    score -= 10;
    why.push({ text: 'covert≠', type: 'neg' });
  }

  // Number agreement
  const hqD = hq.bag.dollars, webD = web.bag.dollars;
  const hqP = hq.bag.percents, webP = web.bag.percents;
  let numbersMismatch = false;

  if (hqD.length && webD.length) {
    let bestDiff = Infinity;
    for (const a of hqD) for (const b of webD) {
      const d = Math.abs(a - b);
      if (d < bestDiff) bestDiff = d;
    }
    if (bestDiff === 0) { score += 6; why.push({ text: '$=' + hqD[0], type: 'pos' }); }
    else if (bestDiff <= 50) { score += 2; why.push({ text: '$≈', type: 'neu' }); }
    else { score -= 5; numbersMismatch = true; why.push({ text: '$≠(' + hqD.join(',') + ' vs ' + webD.join(',') + ')', type: 'neg' }); }
  } else if (hqD.length && !webD.length) { score -= 1; why.push({ text: '$hq-only', type: 'neu' }); }
  else if (!hqD.length && webD.length) { score -= 1; why.push({ text: '$web-only', type: 'neu' }); }

  if (hqP.length && webP.length) {
    let bestDiff = Infinity;
    for (const a of hqP) for (const b of webP) {
      const d = Math.abs(a - b);
      if (d < bestDiff) bestDiff = d;
    }
    if (bestDiff === 0) { score += 5; why.push({ text: '%=' + hqP[0], type: 'pos' }); }
    else if (bestDiff <= 5) { score += 2; why.push({ text: '%≈', type: 'neu' }); }
    else { score -= 4; numbersMismatch = true; why.push({ text: '%≠(' + hqP.join(',') + ' vs ' + webP.join(',') + ')', type: 'neg' }); }
  } else if (hqP.length && !webP.length) { score -= 1; why.push({ text: '%hq-only', type: 'neu' }); }
  else if (!hqP.length && webP.length) { score -= 1; why.push({ text: '%web-only', type: 'neu' }); }

  // Date matching
  let isExtension = false;
  if (hq.ongoing && !web.expiryDate) {
    score += 3; why.push({ text: 'ongoing✓', type: 'pos' });
  } else if (hq.ongoing && web.expiryDate) {
    score -= 1; why.push({ text: 'ongoing/dated', type: 'neu' });
  } else if (hq.end && web.expiryDate) {
    if (sameDay(hq.end, web.expiryDate)) {
      score += 4; why.push({ text: 'date=', type: 'pos' });
    } else {
      const daysDiff = Math.round((hq.end - web.expiryDate) / 86400000);
      if (Math.abs(daysDiff) <= 2) {
        score += 2; why.push({ text: 'date≈' + daysDiff + 'd', type: 'neu' });
      } else if (daysDiff > 2 && daysDiff <= 90 && !numbersMismatch) {
        score += 1; isExtension = true;
        why.push({ text: 'extended+' + daysDiff + 'd', type: 'ext' });
      } else if (daysDiff > 2 && daysDiff <= 90 && numbersMismatch) {
        score -= 2; why.push({ text: 'date-shift+$≠', type: 'neg' });
      } else if (daysDiff < -2) {
        score -= 1; why.push({ text: 'date-behind', type: 'neg' });
      }
    }
  }

  // Text similarity bonus
  if (hqFeats.size === 0 && webFeats.size === 0) {
    const sim = textSimilarity(hq.text, web.text);
    if (sim > 0.3) {
      const pts = Math.round(sim * 10);
      score += pts;
      why.push({ text: 'text(' + Math.round(sim * 100) + '%)', type: 'pos' });
    }
  } else {
    const sim = textSimilarity(hq.text, web.text);
    if (sim > 0.25) {
      const pts = Math.min(3, Math.round(sim * 5));
      score += pts;
      why.push({ text: 'text(' + Math.round(sim * 100) + '%)', type: 'neu' });
    }
  }

  return { score, why, shared, hqOnly, webOnly, isExtension };
}

// --- Hungarian algorithm (unchanged) ---

function hungarian(matrix, n, m) {
  const size = Math.max(n, m);
  const cost = [];
  for (let i = 0; i < size; i++) {
    cost[i] = [];
    for (let j = 0; j < size; j++) {
      cost[i][j] = (i < n && j < m) ? -matrix[i][j].score : 0;
    }
  }

  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0);
  const way = new Array(size + 1).fill(0);

  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(size + 1).fill(Infinity);
    const used = new Array(size + 1).fill(false);
    do {
      used[j0] = true;
      let i0 = p[j0], delta = Infinity, j1;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }

  const result = [];
  const assigned = new Array(n).fill(-1);
  for (let j = 1; j <= size; j++) {
    if (p[j] > 0 && p[j] <= n && j <= m) assigned[p[j] - 1] = j - 1;
  }
  for (let i = 0; i < n; i++) result.push([i, assigned[i]]);
  return result;
}

function greedyMatch(hqGroup, webGroup, matrix) {
  const usedWeb = new Set();
  const results = [];
  const candidates = [];
  for (let i = 0; i < hqGroup.length; i++) {
    for (let j = 0; j < webGroup.length; j++) {
      candidates.push({ i, j, meta: matrix[i][j] });
    }
  }
  candidates.sort((a, b) => b.meta.score - a.meta.score);
  const assignedHQ = new Set();
  const assignment = new Map();
  for (const c of candidates) {
    if (assignedHQ.has(c.i) || usedWeb.has(c.j)) continue;
    if (c.meta.score > 0) {
      assignment.set(c.i, { webIdx: c.j, meta: c.meta });
      assignedHQ.add(c.i);
      usedWeb.add(c.j);
    }
  }
  for (let i = 0; i < hqGroup.length; i++) {
    const a = assignment.get(i);
    results.push({
      hq: hqGroup[i],
      web: a ? webGroup[a.webIdx] : null,
      meta: a ? a.meta : { score: 0, why: [], shared: new Set(), hqOnly: new Set(), webOnly: new Set(), isExtension: false },
    });
  }
  return results;
}

function optimalMatch(hqGroup, webGroup) {
  const n = hqGroup.length, m = webGroup.length;
  const matrix = [];
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < m; j++) {
      matrix[i][j] = scorePair(hqGroup[i], webGroup[j]);
    }
  }
  if (n <= 20 && m <= 20) {
    const assignment = hungarian(matrix, n, m);
    return assignment.map(([i, j]) => ({
      hq: hqGroup[i],
      web: j !== -1 ? webGroup[j] : null,
      meta: j !== -1 ? matrix[i][j] : { score: 0, why: [], shared: new Set(), hqOnly: new Set(), webOnly: new Set(), isExtension: false },
    }));
  }
  return greedyMatch(hqGroup, webGroup, matrix);
}

// --- HQ Parser ---

let nextId = 0;
export function resetIds() { nextId = 0; }

export function parseHQ(text) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let currentVendor = null;

  for (const line of lines) {
    const m = line.match(/^([ve]d?|V|D|ED)\s*\t\s*(.+)$/i);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    const content = m[2].trim();

    if (tag === 'v') {
      currentVendor = canonicalVendor(content.replace(/:$/, ''));
    } else {
      if (!currentVendor) continue;
      const type = tag === 'ed' ? 'exclusive' : 'deal';
      const dates = parseHQDates(content);
      const bag = extractFeatureBag(content);
      items.push({
        id: ++nextId,
        type,
        vendor: currentVendor,
        vendorFamily: vendorFamily(currentVendor),
        text: content,
        originalLine: line,
        start: dates.start,
        end: dates.end,
        ongoing: dates.ongoing,
        dateWarning: dates.dateWarning,
        bag,
      });
    }
  }
  return items;
}

// --- Website JSON ingest ---

export function ingestWebsiteJSON(arr) {
  return (arr || []).map(row => {
    const supplier = row.shopOverline || '';
    const vendor = canonicalVendor(supplier);
    const family = vendorFamily(vendor);
    const expiry = row.expiryDate ? new Date(row.expiryDate) : null;
    const post = row.postDate ? new Date(row.postDate) : null;
    const text = [row.title || '', row.shopListing || ''].join(' · ');
    const bag = extractFeatureBag(text);
    return { raw: row, supplier: vendor, vendorFamily: family, expiryDate: expiry, postDate: post, text, bag };
  });
}

// --- Full matching pipeline ---

export function runFullMatch(hqDeals, websiteDeals, { filterSupplier = '' } = {}) {
  const hqByFamily = {};
  for (const hq of hqDeals) {
    if (filterSupplier && canonicalVendor(hq.vendor) !== canonicalVendor(filterSupplier)) continue;
    const fam = hq.vendorFamily;
    if (!hqByFamily[fam]) hqByFamily[fam] = [];
    hqByFamily[fam].push(hq);
  }

  const webByFamily = {};
  for (const w of websiteDeals) {
    const fam = w.vendorFamily;
    if (!webByFamily[fam]) webByFamily[fam] = [];
    webByFamily[fam].push(w);
  }

  const allResults = [];
  for (const fam of Object.keys(hqByFamily)) {
    const hqGroup = hqByFamily[fam];
    const webGroup = webByFamily[fam] || [];
    if (webGroup.length === 0) {
      for (const hq of hqGroup) {
        allResults.push({
          hq, web: null,
          meta: { score: 0, why: [{ text: 'no web deals', type: 'neg' }], shared: new Set(), hqOnly: new Set(), webOnly: new Set(), isExtension: false },
        });
      }
    } else {
      allResults.push(...optimalMatch(hqGroup, webGroup));
    }
  }
  return allResults;
}

// --- Export unmatched as tagged text ---

export function exportUnmatched(deals) {
  const grouped = {};
  deals.forEach(d => {
    if (!grouped[d.vendor]) grouped[d.vendor] = [];
    grouped[d.vendor].push(d);
  });
  let output = '';
  Object.keys(grouped).sort().forEach(v => {
    output += `v\t${v}\n`;
    grouped[v].forEach(d => {
      const tag = d.type === 'exclusive' ? 'ed' : 'd';
      output += `${tag}\t${d.text}\n`;
    });
  });
  return output.trim();
}
