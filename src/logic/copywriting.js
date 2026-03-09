// =============================================================================
// COPYWRITING LOGIC
// External-AI friendly:
//   - Full batch prompt generation
//   - Single-deal prompt generation
//   - Stable deal IDs
//   - Single-deal patch application
//   - Validation + merge
// =============================================================================

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

// Parse the v/d/ed tagged text into vendor groups, with stable IDs.
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
export function cleanAndParseJSON(input) {
  const start = input.indexOf("[");
  const end = input.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found.");
  let clean = input.substring(start, end + 1);
  clean = clean.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
  return JSON.parse(clean);
}

// Generate the full AI prompt from vendor groups
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

function extractWords(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

// Heuristic allowlist for customer-facing connective language.
const ALLOWED_AI_WORDS = new Set([
  "book",
  "now",
  "your",
  "next",
  "enjoy",
  "receive",
  "save",
  "savings",
  "exclusive",
  "limited",
  "time",
  "offer",
  "available",
  "today",
  "free",
  "for",
  "the",
  "and",
  "with",
  "plus",
  "get",
  "off",
  "take",
  "advantage",
  "features",
  "includes",
  "offers",
  "deal",
  "deals",
  "onboard",
  "credit",
  "per",
  "person",
  "gratuities",
  "call",
  "agent",
  "details",
  "special",
  "rates",
  "rate",
  "pricing",
  "during",
  "guests",
  "guest",
  "stay",
  "stays",
  "hotel",
  "resort",
  "package",
  "packages",
  "flight",
  "booking",
  "bookings",
  "properties",
  "tour",
  "tours",
  "cruise",
  "trip",
  "fare",
  "fares",
  "spend",
  "spending",
  "shop",
  "hidden",
  "secret",
  "simply",
  "show",
  "low",
  "too",
  "good",
  "online",
  "ask",
  "about",
  "sales",
  "sale",
  "member",
  "members",
  "dining",
  "concierge",
]);

const CODE_PATTERN =
  /\b[A-Z]{2,}\d{1,}[A-Z]*\b|\b[A-Z]\d[A-Z]\b|\bpromo\s*code\b/i;
const RATE_CODE_PATTERN = /\([A-Z0-9]{2,6}\)/;

export function validateDeal(aiDeal, rawDeal) {
  const warnings = [];
  const headline = aiDeal.headline || "";
  const description = aiDeal.description || "";
  const combined = `${headline} ${description}`;
  const sourceWords = extractWords(rawDeal.originalText);
  const aiWords = extractWords(combined);

  const suspicious = [];
  for (const word of aiWords) {
    if (!sourceWords.has(word) && !ALLOWED_AI_WORDS.has(word)) {
      suspicious.push(word);
    }
  }

  if (suspicious.length > 0) {
    warnings.push({
      type: "embellishment",
      severity: "warn",
      msg: `AI may have added words not in source: "${suspicious.join('", "')}"`,
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
