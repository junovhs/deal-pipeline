// =============================================================================
// DEALTAG LOGIC — ported from dealtag/index.html
// Bug fixes applied:
//   1. looksLikeVendorCandidate: Unicode-aware regex (fixes Zoëtry etc)
//   2. transform: treat null currentKnown same as false (fixes orphaned deals)
// =============================================================================

import { suppliers, aliases, norm } from './suppliers.js';

const STRICT_SUPPLIERS = true;
const FAMILY_ALIASES_ALLOWED = false;

const familyAliases = new Map();

// --- Stop tokens for Jaccard matching ---
const STOP_TOKENS = new Set([
  "vacations","vacation","tours","tour","travel","travels",
  "holidays","holiday","cruises","cruise","resorts","resort",
  "hotels","hotel","journeys","journey","adventures","adventure"
]);

const tokens = s =>
  new Set(
    norm(s).split(' ').filter(w => w.length > 1 && !STOP_TOKENS.has(w))
  );

// Build supplier index for matching
const supplierIndex = suppliers.map(s => ({
  raw: s.name,
  n: norm(s.name),
  toks: tokens(s.name)
}));

function jaccard(a, b) {
  let i = 0;
  for (const x of a) { if (b.has(x)) i++; }
  return i / (a.size + b.size - i || 1);
}

// Convert Dealtag aliases (which map to lowercase canonical) to proper names
const dealtagAliasMap = new Map();
for (const [key, val] of aliases) {
  dealtagAliasMap.set(key, norm(val));
}

function bestSupplierMatch(name) {
  const raw = name.replace(/^•\s*/, '');
  const n = norm(raw);
  if (!n) return { score: 0, match: null, via: "" };

  // Check aliases
  const a1 = dealtagAliasMap.get(n);
  let normalized = a1 || n;
  if (FAMILY_ALIASES_ALLOWED) {
    const a2 = familyAliases.get(n);
    if (a2) normalized = norm(a2);
  }

  const exact = supplierIndex.find(s => s.n === normalized);
  if (exact) return { score: 1, match: exact.raw, via: a1 ? "alias" : "exact" };

  const t = tokens(normalized);
  let best = { score: 0, match: null, via: "jaccard" };
  for (const s of supplierIndex) {
    const sc = jaccard(t, s.toks);
    if (sc > best.score) best = { score: sc, match: s.raw, via: "jaccard" };
  }
  return best;
}

// --- Line classification regexes (unchanged from original) ---

const SECTION_HEADING = /(offers?)\s*:?\s*$/i;
const DATE_RE = /(?:\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\b\s*\d{1,2},?\s*\d{2,4})/i;
const DEAL_MARKER = /(ends?\b|ongoing\b|end\s*date\b|valid\s*(?:through|until)\b|expires?\b)/i;
const DEAL_CUES = /\b(save|savings?|off|deposit|gratuities|obc|upgrade|kids\s+sail\s+free|reduced)\b/i;

function isExclusiveLine(t) {
  return /\bTLN\b/i.test(t) || /\bEXCLUSIVE\b/.test(t) || /^\s*(?:•\s*)?Exclusive\s*[:\-]/i.test(t);
}

function looksLikeDeal(t) {
  if (!t.trim() || SECTION_HEADING.test(t)) return false;
  if (isExclusiveLine(t)) return true;
  if (DEAL_MARKER.test(t) || DATE_RE.test(t)) return true;
  if (DEAL_CUES.test(t) && /[%$]|\bup to\b|\d/.test(t)) return true;
  return false;
}

function canonicalVendorLabel(line) {
  let stripped = line.replace(/^•\s*/, '').trim();
  if (/^TTC\s+Tour\s+Brands\b/i.test(stripped)) return "Trafalgar";
  return stripped;
}

// BUG FIX: Unicode-aware regex — \p{L} matches any letter including ë, é, etc.
function looksLikeVendorCandidate(t) {
  if (!t.trim() || SECTION_HEADING.test(t)) return false;
  if (looksLikeDeal(t)) return false;
  if (/\b(sale|offer|offers|promo|promotion|deal|special)\b/i.test(t)) return false;

  let trimmed = t.replace(/^•\s*/, '').trim();
  trimmed = trimmed.replace(/[:*–\u2013\u2014]+$/, '').trim();
  if (!trimmed) return false;

  const detectText = trimmed.replace(/\([^)]*\)/g, '').trim() || trimmed;
  if (!detectText) return false;
  if (/[.!?].+/.test(detectText)) return false;

  let words = detectText.split(/\s+/);
  if (words.length > 10) return false;
  words = words.map(w => w.replace(/[,:;]+$/, ''));

  // FIX: Use \p{L} (Unicode Letter) instead of [A-Za-z] to support Zoëtry etc.
  const properish = words.every(w => /^[\p{L}&.\-''()/]+$/u.test(w));
  return properish;
}

function isKnownSupplier(line) {
  const label = canonicalVendorLabel(line);
  const { score, via } = bestSupplierMatch(label.trim());
  return STRICT_SUPPLIERS
    ? (via === "alias" || via === "exact" || (via === "jaccard" && score >= 0.3))
    : (score >= 0.34 || via === "alias");
}

function isContinuation(line) {
  // Matches lines starting with (, •, │, or -
  return /^\s*(\(|│-)/.test(line);
}

// --- Main transform function ---

export function transform(raw, { includeUnknowns = true } = {}) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let lastIndex = -1;
  let currentKnown = null;
  let lastWasDeal = false;
  let vendorCount = 0, dealCount = 0, exclCount = 0, unknownCount = 0;

  for (const orig of lines) {
    const vis = orig.trim();
    if (!vis) continue;

    if (SECTION_HEADING.test(vis)) {
      currentKnown = null;
      lastWasDeal = false;
      lastIndex = -1;
      continue;
    }

    // Glue continuations to previous emitted line
    if (isContinuation(orig) && lastWasDeal && lastIndex >= 0) {
      out[lastIndex] = out[lastIndex] + " " + orig.trimStart();
      continue;
    }

    if (looksLikeDeal(orig)) {
      const ex = isExclusiveLine(orig);
      let tag = ex ? "ed" : "d";

      // BUG FIX: treat null (no vendor seen yet) same as false (unknown vendor)
      if (currentKnown === false || currentKnown === null) {
        tag = "X";
      } else {
        if (ex) exclCount++;
        dealCount++;
      }

      const lineText = `${tag}\t${orig}`;
      if (tag !== "X" || includeUnknowns) {
        out.push(lineText);
        lastWasDeal = true;
        lastIndex = out.length - 1;
      } else {
        lastWasDeal = false;
        lastIndex = -1;
      }
      continue;
    }

    if (looksLikeVendorCandidate(orig)) {
      if (isKnownSupplier(orig)) {
        const label = canonicalVendorLabel(orig);
        vendorCount++;
        const lineText = `v\t${label}`;
        out.push(lineText);
        currentKnown = true;
        lastWasDeal = false;
        lastIndex = out.length - 1;
      } else {
        unknownCount++;
        currentKnown = false;
        lastWasDeal = false;
        if (includeUnknowns) {
          out.push(`X\t${orig}`);
          lastIndex = out.length - 1;
        } else {
          lastIndex = -1;
        }
      }
      continue;
    }
  }

  return {
    text: out.join("\n"),
    stats: {
      vendors: vendorCount,
      deals: dealCount,
      excl: exclCount,
      unknownSuppliers: unknownCount,
      lines: lines.length
    }
  };
}
