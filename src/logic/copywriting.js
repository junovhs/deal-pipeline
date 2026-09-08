// =============================================================================
// COPYWRITING LOGIC
// External-AI friendly:
//   - Full batch prompt generation
//   - Single-deal prompt generation
//   - Stable deal IDs
//   - Single-deal patch application
//   - Validation + merge
// =============================================================================

/** Default operator-editable policy embedded in batch and repair prompts. */
export const DEFAULT_HOUSE_STYLE = `ABSOLUTE RULES (violating these is a critical error):

1. NEVER ADD FACTUAL CLAIMS that are not in the source.
- If the source says "$100 OBC", do NOT add "per stateroom", "per person", "per cabin", or any other qualifier that isn't explicitly stated.
- If the source says "PPGs for 2", that means "Free Gratuities for 2" — do NOT change the meaning.
- Do NOT invent restrictions, conditions, or specifics.
- Natural customer-facing phrasing is allowed, but do not add new facts.

2. NEVER use rate codes, promo codes, or booking codes.
- Ignore codes like (PB4), (O7J), EZVA, SMOFFER2026, etc.
- They must NOT appear in headlines or descriptions.

3. Accuracy is paramount.
- Preserve qualifiers like "up to", "from", and "select sailings" when present.
- Do not change dollar or percentage amounts.
- Do not round numbers.

4. Hidden-price deals:
- Never use the words "covert" or "opaque" in customer-facing copy.
- Translate them into customer-facing language like "hidden savings", "hidden fares", "too low to show", "special rates", or similar.
- These deals must tell the customer to call an agent for details.

5. Exclusives:
- If the deal is marked exclusive, the headline must start with "EXCLUSIVE: ".

TONE & STYLE:
- Customer-facing marketing copy, not internal notes.
- Clear, warm, concise, natural.
- Headlines should feel like real promo headlines, not awkward internal labels.
- Prefer CTA-led phrasing like Get, Enjoy, Save, Receive when natural.
- Avoid robotic phrases like "offer applies on", "book the sale", "is available now" repeated mechanically.
- Headlines: ideally 8-12 words.
- Descriptions: ideally 10-16 words.
- Headline and description must say different things.
- If the source has a branded sale name, use it naturally in the description.
- Use "Save" instead of "Keep".

BANNED WORDS:
"Sail Away", "Unlock", "Score", "Indulge", "Savor", "Escape", "Dream", "Paradise", "Awaits", "Magic", "Breath-taking"

TERM REPLACEMENTS:
- PPG → "Free Gratuities"
- OBC → "Onboard Credit"
- PP → "Per Person"`;

/**
 * Parses tagged `v`/`d`/`ed` text into ordered vendor groups for AI prompting.
 * Deal IDs are stable within the parsed batch, exclusivity comes only from the
 * `ed` tag, and orphan deal lines are ignored rather than assigned to the wrong
 * supplier.
 */
export function parseRawToGroups(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const groups = [];
  let currentVendor = null;
  let vendorCounter = 0;

  lines.forEach((line) => {
    const parts = line.split(/\s(.+)/);
    if (parts.length < 2) return;
    const [type, content] = parts;
    const cleanContent = content.trim();

    if (type === "v") {
      vendorCounter += 1;
      currentVendor = {
        vendorIndex: vendorCounter,
        name: cleanContent,
        deals: [],
      };
      groups.push(currentVendor);
    } else if ((type === "d" || type === "ed") && currentVendor) {
      const dealIndex = currentVendor.deals.length + 1;
      currentVendor.deals.push({
        dealId: `v${currentVendor.vendorIndex}d${dealIndex}`,
        dealIndex,
        originalText: cleanContent,
        isExclusive: type === "ed",
      });
    }
  });

  return groups;
}

// Clean AI response and extract JSON array
/**
 * Extracts the outer JSON array from an AI response and tolerates trailing
 * commas. Structural cardinality and factual safety are validated separately
 * by `validateAndMerge`.
 */
export function cleanAndParseJSON(input) {
  const start = input.indexOf("[");
  const end = input.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found.");
  let clean = input.substring(start, end + 1);
  clean = clean.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
  return JSON.parse(clean);
}

/**
 * Produces the batch copywriting prompt while preserving vendor and deal order
 * as a cardinality contract. The prompt requires structured dates, forbids
 * supplier names and expiry dates in customer copy, and embeds the editable
 * house style without trusting the AI output as validated data.
 */
export function generatePrompt(groups, houseStyle = DEFAULT_HOUSE_STYLE) {
  let promptText = `You are a travel marketing assistant writing deal copy for a website.

${houseStyle}

JSON OUTPUT RULES:
1. Return a JSON array that MIRRORS the input exactly (same number of vendors, same number of deals per vendor).
2. Extract "startDate" and "endDate" in MM/DD/YYYY format from the text. If a date looks suspicious or malformed, set it to null and add "dateNote": "possible typo: [original text]".
3. Do NOT include the expiry date in the headline or description.
4. Do NOT include the vendor name in the headline or description.

INPUT DATA:
`;

  groups.forEach((g, i) => {
    promptText += `\nVENDOR ${i + 1}: ${g.name}\n`;
    g.deals.forEach((d, j) => {
      const alreadyLabeled = /^\s*EXCLUSIVE\b/i.test(d.originalText);
      const prefix = d.isExclusive && !alreadyLabeled ? "(EXCLUSIVE) " : "";
      promptText += `   Deal ${j + 1}: ${prefix}${d.originalText}\n`;
    });
  });

  promptText += `
OUTPUT JSON FORMAT:
[
  {
    "vendorIndex": 1,
    "deals": [
      {
        "headline": "...",
        "description": "...",
        "startDate": "MM/DD/YYYY or null",
        "endDate": "MM/DD/YYYY or null",
        "dateNote": "optional, only if date looks suspicious"
      }
    ]
  }
]`;

  return promptText;
}

// Generate a prompt for a single deal repair/regeneration.
/**
 * Builds a narrowly scoped repair prompt for one selected deal, including its
 * source, current copy, exclusivity, house style, and optional operator note.
 * The requested response is one bare JSON object suitable for patch parsing.
 */
export function generateSingleDealPrompt({
  vendorName,
  deal,
  note = "",
  currentHeadline = "",
  currentDescription = "",
  houseStyle = DEFAULT_HOUSE_STYLE,
}) {
  return `You are a travel marketing assistant writing deal copy for a website.

${houseStyle}

TASK:
Rewrite ONLY this one deal.

SOURCE DEAL:
Vendor: ${vendorName}
Deal: ${deal.originalText}
Exclusive: ${deal.isExclusive ? "yes" : "no"}

CURRENT COPY:
Headline: ${currentHeadline || "(none)"}
Description: ${currentDescription || "(none)"}

${note ? `EDITOR NOTE:\n${note}\n` : ""}OUTPUT RULES:
- Return ONLY a JSON object.
- Do not wrap in markdown fences.
- Do not include commentary.
- Do not include the vendor name.
- Do not include the expiry date in headline or description.
- If exclusive, headline must begin with "EXCLUSIVE: ".

JSON FORMAT:
{
  "headline": "...",
  "description": "...",
  "startDate": "MM/DD/YYYY or null",
  "endDate": "MM/DD/YYYY or null",
  "dateNote": "optional, only if needed"
}`;
}

// Only claims that can change the substance or scope of an offer belong in the
// review gate. Ordinary word novelty is expected when terse source copy is
// rewritten as customer-facing prose.
const MATERIAL_CLAIM_GROUPS = [
  ["upgrade", "upgrades"],
  ["onboard credit", "shipboard credit", "obc"],
  ["resort credit"],
  ["bar tab"],
  ["gratuities", "tipping"],
  ["transfer", "transfers"],
  ["dining", "dinner", "meal", "meals"],
  ["wifi", "wi-fi", "internet"],
  ["drink", "drinks", "beverage", "beverages"],
  ["mile", "miles"],
  ["night", "nights"],
  ["kids sail free", "kids stay free", "children sail free", "children stay free"],
];

const MATERIAL_SCOPE_GROUPS = [
  ["shore excursion", "shore excursions"],
  ["spa", "spa service", "spa services", "spa treatment", "spa treatments"],
  ["specialty dining", "specialty dinner"],
  ["flight and hotel", "flight and resort", "bundle"],
];

// Product or destination nouns are material when the headline uses them to
// define the offer. In body copy they are often harmless supplier context.
const HEADLINE_SCOPE_GROUPS = [
  ["river", "river cruise", "river cruises"],
  ["ocean", "ocean cruise", "ocean cruises"],
  ["expedition", "expeditions"],
  ["yacht", "yachts"],
  ["safari", "safaris"],
  ["africa", "african"],
  ["alaska", "alaskan"],
  ["caribbean"],
  ["bahamas"],
  ["bermuda"],
  ["europe", "european"],
  ["south pacific"],
  ["stateroom", "staterooms", "room", "rooms"],
];

const NUMBER_WORDS = new Map([
  ["one", "1"], ["two", "2"], ["three", "3"], ["four", "4"],
  ["five", "5"], ["six", "6"], ["seven", "7"], ["eight", "8"],
  ["nine", "9"], ["ten", "10"], ["eleven", "11"], ["twelve", "12"],
  ["first", "1"], ["second", "2"], ["third", "3"], ["fourth", "4"],
]);

function normalizeClaimText(text) {
  return ` ${(text || "")
    .toLowerCase()
    .replace(/[,$]/g, "")
    .replace(/[^a-z0-9%+\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function hasPhrase(text, phrase) {
  return text.includes(` ${phrase} `);
}

function findIntroducedGroups(sourceText, outputText, groups) {
  return groups
    .filter((group) =>
      group.some((term) => hasPhrase(outputText, term)) &&
      !group.some((term) => hasPhrase(sourceText, term)))
    .map((group) => group.find((term) => hasPhrase(outputText, term)));
}

function extractClaimNumbers(text) {
  const withoutDates = (text || "").replace(
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4})?\b/g,
    " ",
  );
  const normalized = normalizeClaimText(withoutDates);
  const values = new Set();
  for (const match of normalized.matchAll(/\b(\d+(?:\.\d+)?)(?:st|nd|rd|th)?(%?)\b/g)) {
    const value = `${match[1]}${match[2]}`;
    // Calendar years and date components are validated separately.
    if (!value.endsWith("%") && Number(value) >= 2000 && Number(value) <= 2100) continue;
    values.add(value);
  }
  for (const [word, value] of NUMBER_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) values.add(value);
  }
  return values;
}

const CODE_PATTERN =
  /\b[A-Z]{2,}\d{1,}[A-Z]*\b|\b[A-Z]\d[A-Z]\b|\bpromo\s*code\b/i;
const RATE_CODE_PATTERN = /\([A-Z0-9]{2,6}\)/;

const SLUG_STOP_WORDS = new Set([
  "exclusive", "save", "get", "receive", "enjoy", "with", "your", "the",
  "for", "and", "plus", "up", "to", "on", "a", "an",
]);

function randomUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random slug generation is unavailable in this browser.");
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

/**
 * Creates a URL-safe, recognizable slug from up to two meaningful deal words
 * plus a cryptographically random UUID v4. Callers persist the returned value;
 * regenerating it intentionally creates a new public identifier.
 */
export function createDealSlug(text) {
  const words = (text || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((word) => /[a-z]/.test(word) && !SLUG_STOP_WORDS.has(word))
    .slice(0, 2);
  const readablePrefix = words.length > 0 ? words.join("-") : "deal";
  return `${readablePrefix}-${randomUuid()}`;
}

/**
 * Compares proposed customer copy with its source deal and returns actionable
 * findings for material drift, leaked codes, suspect dates, excessive length,
 * and exclusivity formatting. Ordinary marketing paraphrases are allowed;
 * errors represent blockers while warnings require operator judgment.
 */
export function validateDeal(aiDeal, rawDeal) {
  const warnings = [];
  for (const field of ['headline', 'description']) {
    if (typeof aiDeal[field] !== 'string' || !aiDeal[field].trim() || /\bMISSING (?:HEADLINE|DESCRIPTION)\b/i.test(aiDeal[field])) {
      warnings.push({ type: 'missing-copy', ruleId: 'COPY.REQUIRED_FIELD', severity: 'error', msg: `The ${field} is missing. Add customer copy before publishing.` });
    }
  }
  const parsedDates = {};
  for (const field of ['startDate', 'endDate']) {
    if (!aiDeal[field]) continue;
    const match = String(aiDeal[field]).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    let valid = false;
    if (match) {
      let year = Number(match[3]);
      if (match[3].length === 2) year += year >= 70 ? 1900 : 2000;
      const date = new Date(year, Number(match[1]) - 1, Number(match[2]));
      valid = date.getFullYear() === year && date.getMonth() === Number(match[1]) - 1 && date.getDate() === Number(match[2]);
      if (valid) parsedDates[field] = date;
    }
    if (!valid) warnings.push({ type: 'date', ruleId: 'COPY.INVALID_DATE', severity: 'error', msg: `${field} must be a real calendar date in M/D/YY or M/D/YYYY format.` });
  }
  if (parsedDates.startDate && parsedDates.endDate && parsedDates.startDate > parsedDates.endDate) {
    warnings.push({ type: 'date', ruleId: 'COPY.DATE_ORDER', severity: 'error', msg: 'The start date is after the end date.' });
  }
  const headline = typeof aiDeal.headline === 'string' ? aiDeal.headline : "";
  const description = typeof aiDeal.description === 'string' ? aiDeal.description : "";
  const combined = `${headline} ${description}`;
  const sourceText = normalizeClaimText(rawDeal.originalText);
  const outputText = normalizeClaimText(combined);
  const sourceNumbers = extractClaimNumbers(rawDeal.originalText);
  const outputNumbers = extractClaimNumbers(combined);
  const introducedNumbers = [...outputNumbers].filter((value) => !sourceNumbers.has(value));
  const removedNumbers = [...sourceNumbers].filter((value) => !outputNumbers.has(value));

  if (introducedNumbers.length > 0) {
    warnings.push({
      type: "material-number",
      ruleId: "COPY.NUMBER_ADDED",
      severity: "error",
      msg: `Output adds a numeric claim not found in the source: ${introducedNumbers.join(", ")}.`,
    });
  }

  if (removedNumbers.length > 0) {
    warnings.push({
      type: "material-number",
      ruleId: "COPY.NUMBER_REMOVED",
      severity: "error",
      msg: `Output omits a numeric term from the offer: ${removedNumbers.join(", ")}.`,
    });
  }

  const introducedBenefits = findIntroducedGroups(
    sourceText,
    outputText,
    MATERIAL_CLAIM_GROUPS,
  );
  const introducedScope = findIntroducedGroups(
    sourceText,
    outputText,
    MATERIAL_SCOPE_GROUPS,
  );
  const introducedHeadlineScope = findIntroducedGroups(
    sourceText,
    normalizeClaimText(headline),
    HEADLINE_SCOPE_GROUPS,
  );
  introducedScope.push(...introducedHeadlineScope);
  const nonDuplicateBenefits = introducedBenefits.filter(
    (benefit) => !(benefit === "dining" && introducedScope.includes("specialty dining")),
  );
  if (nonDuplicateBenefits.length > 0) {
    warnings.push({
      type: "material-benefit",
      ruleId: "COPY.BENEFIT_ADDED",
      severity: "warn",
      msg: `Output may add a benefit not stated in the source: ${nonDuplicateBenefits.join(", ")}.`,
    });
  }
  if (introducedScope.length > 0) {
    warnings.push({
      type: "material-scope",
      ruleId: "COPY.SCOPE_ADDED",
      severity: "warn",
      msg: `Output may narrow or expand the offer's scope: ${introducedScope.join(", ")}.`,
    });
  }

  if (hasPhrase(sourceText, "up to") && !hasPhrase(outputText, "up to")) {
    warnings.push({
      type: "material-limit",
      ruleId: "COPY.UP_TO_REMOVED",
      severity: "error",
      msg: 'Source says "up to," but the output presents the benefit without that limit.',
    });
  }

  const bookingYear = rawDeal.originalText.match(/\b(20\d{2})\s+bookings?\b/i);
  if (
    bookingYear &&
    (!new RegExp(`\\b${bookingYear[1]}\\b`).test(combined) ||
      !/\bbook(?:ing|ings)?\b/i.test(combined))
  ) {
    warnings.push({
      type: "material-condition",
      ruleId: "COPY.BOOKING_YEAR_CHANGED",
      severity: "error",
      msg: `${bookingYear[1]} is a booking condition in the source; the output omits it or may present it as a travel year.`,
    });
  }

  if (CODE_PATTERN.test(combined) || RATE_CODE_PATTERN.test(combined)) {
    warnings.push({
      type: "code",
      severity: "error",
      msg: "Output contains what looks like a promo/rate code. These must be removed.",
    });
  }

  if (aiDeal.dateNote) {
    warnings.push({
      type: "date",
      severity: "error",
      msg: `AI flagged a date issue: ${aiDeal.dateNote}`,
      needsInput: true,
    });
  }

  if (aiDeal.endDate) {
    const sourceText = rawDeal.originalText.toLowerCase();
    const dateMatches = sourceText.match(/\d{1,2}\/\d{1,2}\/([a-z]\d|\d[a-z])/);
    if (dateMatches) {
      warnings.push({
        type: "date",
        severity: "error",
        msg: `Source has possible date typo: "${dateMatches[0]}". AI may have guessed the date. Please verify.`,
        needsInput: true,
      });
    }
  }

  const headlineWords = headline.split(/\s+/).filter(Boolean).length;
  if (headlineWords > 14) {
    warnings.push({
      type: "length",
      severity: "warn",
      msg: `Headline is ${headlineWords} words (target: 8-12).`,
    });
  }

  const descWords = description.split(/\s+/).filter(Boolean).length;
  if (descWords > 18) {
    warnings.push({
      type: "length",
      severity: "warn",
      msg: `Description is ${descWords} words (target: 10-16).`,
    });
  }

  if (rawDeal.isExclusive && !headline.startsWith("EXCLUSIVE:")) {
    warnings.push({
      type: "format",
      severity: "error",
      msg: 'Exclusive deal headline must start with "EXCLUSIVE: ".',
    });
  }

  return warnings;
}

function buildFinalDescription(baseDescription, endDateStr) {
  let desc = (baseDescription || "MISSING DESCRIPTION").trim();
  if (!/[.!?]$/.test(desc)) desc += ".";

  if (!endDateStr || typeof endDateStr !== "string") {
    desc += " Call to speak with an agent!";
    return desc;
  }

  const parts = endDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!parts) {
    desc += " Call to speak with an agent!";
    return desc;
  }

  let year = parseInt(parts[3], 10);
  if (parts[3].length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
  const endDate = new Date(
    year,
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
  );
  const now = new Date();
  const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    const shortDate = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    desc += ` Ends ${shortDate}.`;
  } else {
    desc += " Call to speak with an agent!";
  }

  return desc;
}

/**
 * Validates an entire AI response against the source batch before constructing
 * editable deal rows. Vendor or per-vendor deal-count changes fail closed;
 * accepted rows retain source provenance, receive unique slugs, and aggregate
 * per-deal lint findings for the review gate.
 */
export function validateAndMerge(rawGroups, jsonInput) {
  const aiGroups = cleanAndParseJSON(jsonInput);

  if (rawGroups.length !== aiGroups.length) {
    return {
      error: {
        title: "Vendor Count Mismatch",
        msg: `You provided ${rawGroups.length} vendors, but AI returned ${aiGroups.length}.`,
      },
    };
  }

  const errors = [];
  const allWarnings = [];

  const generatedSlugs = new Set();
  const mergedData = rawGroups.map((rawGroup, idx) => {
    const aiGroup = aiGroups[idx];

    if (rawGroup.deals.length !== aiGroup.deals.length) {
      errors.push(
        `Vendor "${rawGroup.name}": Sent ${rawGroup.deals.length} deals, got ${aiGroup.deals.length}.`,
      );
    }

    const mergedDeals = rawGroup.deals.map((rawDeal, dealIdx) => {
      const aiDeal = aiGroup.deals[dealIdx] || {};
      const warnings = validateDeal(aiDeal, rawDeal);
      let urlSlug;
      do {
        urlSlug = createDealSlug(aiDeal.headline || rawDeal.originalText);
      } while (generatedSlugs.has(urlSlug));
      generatedSlugs.add(urlSlug);

      if (warnings.length > 0) {
        allWarnings.push({
          vendorName: rawGroup.name,
          dealIdx: dealIdx + 1,
          dealText: rawDeal.originalText,
          headline: aiDeal.headline,
          description: aiDeal.description,
          warnings,
        });
      }

      const finalDescription = buildFinalDescription(
        aiDeal.description,
        aiDeal.endDate,
      );

      return {
        dealId: rawDeal.dealId,
        dealIndex: rawDeal.dealIndex,
        urlSlug,
        headline: aiDeal.headline || "MISSING HEADLINE",
        description: finalDescription,
        startDate: aiDeal.startDate ?? null,
        endDate: aiDeal.endDate ?? null,
        dateNote: aiDeal.dateNote || null,
        originalText: rawDeal.originalText,
        isExclusive: rawDeal.isExclusive,
        warnings,
        checked: false,
      };
    });

    return {
      vendorIndex: rawGroup.vendorIndex,
      name: rawGroup.name,
      deals: mergedDeals,
    };
  });

  if (errors.length > 0) {
    return {
      error: {
        title: "Deal Count Mismatch",
        msg: "The AI dropped or added deals. Please fix JSON or regenerate.",
        details: errors,
      },
    };
  }

  return { data: mergedData, warnings: allWarnings };
}

// --- Single-deal patch helpers ---

/**
 * Extracts a single-deal repair payload from a bare object, vendor wrapper, or
 * batch-shaped array and tolerates trailing commas. Semantic targeting is left
 * to `extractDealPatch` and `applyDealPatch`.
 */
export function cleanAndParsePatchJSON(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) throw new Error("Patch JSON is empty.");

  const objStart = trimmed.indexOf("{");
  const objEnd = trimmed.lastIndexOf("}");
  const arrStart = trimmed.indexOf("[");
  const arrEnd = trimmed.lastIndexOf("]");

  let clean = trimmed;
  if (arrStart !== -1 && arrEnd !== -1 && arrStart < objStart) {
    clean = trimmed.substring(arrStart, arrEnd + 1);
  } else if (objStart !== -1 && objEnd !== -1) {
    clean = trimmed.substring(objStart, objEnd + 1);
  }

  clean = clean.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
  return JSON.parse(clean);
}

/**
 * Normalizes supported repair-response shapes into one patch and fills missing
 * identity fields from the deal the operator selected. Empty or malformed
 * wrapper shapes fail explicitly instead of patching an arbitrary row.
 */
export function extractDealPatch(parsed, selectedContext = null) {
  if (Array.isArray(parsed)) {
    if (!parsed.length) throw new Error("Patch array is empty.");
    const firstVendor = parsed[0];
    if (
      !firstVendor ||
      !Array.isArray(firstVendor.deals) ||
      !firstVendor.deals.length
    ) {
      throw new Error("Patch array format is invalid.");
    }
    return {
      vendorIndex: firstVendor.vendorIndex,
      ...firstVendor.deals[0],
    };
  }

  if (parsed && Array.isArray(parsed.deals)) {
    if (!parsed.deals.length) throw new Error("Patch deals array is empty.");
    return {
      vendorIndex: parsed.vendorIndex,
      ...parsed.deals[0],
    };
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Patch must be a JSON object or array.");
  }

  const out = { ...parsed };
  if (!out.dealId && selectedContext?.dealId)
    out.dealId = selectedContext.dealId;
  if (!out.vendorIndex && selectedContext?.vendorIndex)
    out.vendorIndex = selectedContext.vendorIndex;
  if (!out.dealIndex && selectedContext?.dealIndex)
    out.dealIndex = selectedContext.dealIndex;
  return out;
}

/**
 * Applies a normalized repair to exactly one copied deal using stable ID or
 * vendor/deal position, then rebuilds the final description and reruns lint.
 * The input group tree is cloned so session updates remain immutable.
 */
export function applyDealPatch(finalGroups, patch, selectedContext = null) {
  const normalized = extractDealPatch(patch, selectedContext);

  const nextGroups = finalGroups.map((group) => ({
    ...group,
    deals: group.deals.map((deal) => ({ ...deal })),
  }));

  let target = null;
  let targetGroup = null;

  for (const group of nextGroups) {
    for (const deal of group.deals) {
      const matchById = normalized.dealId && deal.dealId === normalized.dealId;
      const matchByPosition =
        normalized.vendorIndex === group.vendorIndex &&
        normalized.dealIndex === deal.dealIndex;

      if (matchById || matchByPosition) {
        target = deal;
        targetGroup = group;
        break;
      }
    }
    if (target) break;
  }

  if (!target || !targetGroup) {
    throw new Error("Could not find the deal to patch.");
  }

  const updated = {
    ...target,
    headline: normalized.headline ?? target.headline,
    description:
      normalized.description != null
        ? buildFinalDescription(
            normalized.description,
            normalized.endDate ?? target.endDate,
          )
        : target.description,
    startDate: normalized.startDate ?? target.startDate ?? null,
    endDate: normalized.endDate ?? target.endDate ?? null,
    dateNote: normalized.dateNote ?? null,
  };

  updated.warnings = validateDeal(
    {
      headline: updated.headline,
      description: updated.description,
      startDate: updated.startDate,
      endDate: updated.endDate,
      dateNote: updated.dateNote,
    },
    {
      originalText: updated.originalText,
      isExclusive: updated.isExclusive,
    },
  );

  const dealIdx = targetGroup.deals.findIndex(
    (d) => d.dealId === target.dealId,
  );
  targetGroup.deals[dealIdx] = updated;

  return nextGroups;
}

// Add a new raw deal line block to the tagged input.
/**
 * Inserts a quick-added deal beneath an existing tagged supplier or appends a
 * new supplier block. The helper validates non-empty operator input and emits
 * the same `v`/`d`/`ed` format consumed by the rest of the pipeline.
 */
export function appendDealToRawInput(
  rawInput,
  { vendorName, dealText, isExclusive },
) {
  const trimmedVendor = (vendorName || "").trim();
  const trimmedDeal = (dealText || "").trim();

  if (!trimmedVendor || !trimmedDeal) {
    throw new Error("Vendor and deal text are required.");
  }

  const lines = (rawInput || "").split("\n");
  const vendorLine = `v ${trimmedVendor}`;
  const dealLine = `${isExclusive ? "ed" : "d"} ${trimmedDeal}`;

  const vendorIdx = lines.findIndex((line) => line.trim() === vendorLine);

  if (vendorIdx === -1) {
    const prefix = rawInput && !rawInput.endsWith("\n") ? "\n" : "";
    return `${rawInput}${prefix}${vendorLine}\n${dealLine}`.trim();
  }

  const insertAt = (() => {
    let i = vendorIdx + 1;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith("v ")) break;
      i += 1;
    }
    return i;
  })();

  const nextLines = [...lines];
  nextLines.splice(insertAt, 0, dealLine);
  return nextLines.join("\n").trim();
}
