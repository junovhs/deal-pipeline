// =============================================================================
// DEALTAG LOGIC
// Shared supplier normalization now lives in suppliers.js so tagging and dedupe
// classify the same vendor labels the same way.
// =============================================================================

import { resolveVendor } from './suppliers.js';

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
  if (/^TTC\s+Tour\s+Brands\b/i.test(stripped)) return 'Trafalgar';
  return stripped;
}

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
  words = words.map((word) => word.replace(/[,:;]+$/, ''));

  return words.every((word) => /^[\p{L}&.\-''()/]+$/u.test(word));
}

function isKnownSupplier(line) {
  const label = canonicalVendorLabel(line);
  const resolution = resolveVendor(label.trim());
  return resolution.status === 'known' || (resolution.status === 'ambiguous' && Boolean(resolution.familyKey));
}

function isContinuation(line) {
  return /^\s*(\(|│|-)/.test(line);
}

export function transform(raw, { includeUnknowns = true } = {}) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let lastIndex = -1;
  let currentKnown = null;
  let lastWasDeal = false;
  let vendorCount = 0;
  let dealCount = 0;
  let exclCount = 0;
  let ambiguousCount = 0;
  let unknownCount = 0;

  for (const orig of lines) {
    const vis = orig.trim();
    if (!vis) continue;

    if (SECTION_HEADING.test(vis)) {
      currentKnown = null;
      lastWasDeal = false;
      lastIndex = -1;
      continue;
    }

    if (isContinuation(orig) && lastWasDeal && lastIndex >= 0) {
      out[lastIndex] = `${out[lastIndex]} ${orig.trimStart()}`;
      continue;
    }

    if (looksLikeDeal(orig)) {
      const ex = isExclusiveLine(orig);
      let tag = ex ? 'ed' : 'd';

      if (currentKnown === false || currentKnown === null) {
        tag = 'X';
      } else {
        if (ex) exclCount++;
        dealCount++;
      }

      const lineText = `${tag}\t${orig}`;
      if (tag !== 'X' || includeUnknowns) {
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
      const label = canonicalVendorLabel(orig);
      const resolution = resolveVendor(label.trim());
      if (resolution.status === 'known' || (resolution.status === 'ambiguous' && resolution.familyKey)) {
        vendorCount++;
        if (resolution.status === 'ambiguous') ambiguousCount++;
        out.push(`v\t${label}`);
        currentKnown = true;
        lastWasDeal = false;
        lastIndex = out.length - 1;
      } else {
        if (resolution.status === 'ambiguous') ambiguousCount++;
        else unknownCount++;
        currentKnown = false;
        lastWasDeal = false;
        if (includeUnknowns) {
          out.push(`X\t${orig}`);
          lastIndex = out.length - 1;
        } else {
          lastIndex = -1;
        }
      }
    }
  }

  return {
    text: out.join('\n'),
    stats: {
      vendors: vendorCount,
      deals: dealCount,
      excl: exclCount,
      ambiguousSuppliers: ambiguousCount,
      unknownSuppliers: unknownCount,
      lines: lines.length,
    },
  };
}
