// =============================================================================
// COPYWRITING LOGIC
// Changes:
//   - Merged prompt: best of old + new (rate code ban, no embellishment, etc.)
//   - Fixed double EXCLUSIVE in prompt generation
//   - Validation gate: catches embellishments, suspicious dates, promo codes
//   - 30-day rule: within 30 days = "Ends M/D.", else = "Call to speak with an agent!"
// =============================================================================

// Parse the v/d/ed tagged text into vendor groups
export function parseRawToGroups(text) {
  if (!text) return [];
  const lines = text.split("\n");
  let groups = [];
  let currentVendor = null;

  lines.forEach(line => {
    const parts = line.split(/\s(.+)/);
    if (parts.length < 2) return;
    const [type, content] = parts;
    const cleanContent = content.trim();

    if (type === "v") {
      currentVendor = { name: cleanContent, deals: [] };
      groups.push(currentVendor);
    } else if ((type === "d" || type === "ed") && currentVendor) {
      currentVendor.deals.push({
        originalText: cleanContent,
        isExclusive: type === 'ed'
      });
    }
  });
  return groups;
}

// Clean AI response and extract JSON array
export function cleanAndParseJSON(input) {
  const start = input.indexOf('[');
  const end = input.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error("No JSON array found.");
  let clean = input.substring(start, end + 1);
  clean = clean.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
  return JSON.parse(clean);
}

// Generate the AI prompt from vendor groups
export function generatePrompt(groups) {
  let promptText = `You are a travel marketing assistant writing deal copy for a website.

ABSOLUTE RULES (violating these is a critical error):

1. **NEVER ADD FACTUAL CLAIMS that are not in the source.**
   - If the source says "$100 OBC", do NOT add "per stateroom", "per person", "per cabin", or any other qualifier that isn't explicitly stated.
   - If the source says "PPGs for 2", that means "Free Gratuities for 2" — do NOT rephrase as "for Two Select Sailings" or change the meaning.
   - Do NOT invent restrictions, conditions, or specifics. Only state what the source explicitly says.
   - You CAN use normal verbs and sentence structure to write natural copy — just don't add claims about the deal that aren't in the source.

2. **NEVER use rate codes, promo codes, or booking codes.**
   - If the source contains codes like (PB4), (O7J), (EZVA), SMOFFER2026, SMMED300, etc., IGNORE THEM COMPLETELY.
   - The sales agent handles codes. They must NOT appear in headlines or descriptions.

3. **Accuracy is paramount.**
   - ALWAYS preserve qualifiers: "up to", "from", "select sailings" — if they appear in the source, they MUST appear in your copy.
   - Do not "interpret" deal values. "Savings" stays "Savings" or "Save". Do NOT change to "Keep", "Earn", or "Get back".
   - Do not round numbers or change dollar/percentage amounts.

4. **Covert/opaque deals:**
   - These have hidden pricing. The copy should suggest this is an appealing rate and a special opportunity, and must say to call an agent for details.

5. **Exclusives:**
   - If the deal is marked (EXCLUSIVE), the headline MUST start with "EXCLUSIVE: ".

TONE & STYLE:
- Straightforward, professional, concise. No marketing fluff.
- Headlines: 8-12 words.
- Descriptions: 10-16 words.
- Use "Save" instead of "Keep".
- If the title has a Branded Sale name (e.g., "Have It All Sale", "Free at Sea"), use that name in the description.

**CRITICAL: HEADLINE AND DESCRIPTION MUST SAY DIFFERENT THINGS.**
- The headline captures WHAT the deal is (the value proposition).
- The description adds a different angle: WHY to act, HOW to use it, or WHO it's for. It should NOT just reword the headline.
- Vary your sentence structure across deals. Do not use the same template repeatedly.
- Good example:
  Headline: "Enjoy Up to $100 Onboard Credit on Select Sailings"
  Description: "Book a warm weather cruise and receive Onboard Credit to spend onboard."
- Bad example (just restates headline):
  Headline: "Receive Up to $100 Onboard Credit on Select Sailings"
  Description: "Offer features up to $100 Onboard Credit on select sailings."

BANNED WORDS: "Sail Away", "Unlock", "Score", "Indulge", "Savor", "Escape", "Dream", "Paradise", "Awaits", "Magic", "Breath-taking"
(Standard words like "Save", "Book", "Enjoy", "Exclusive", "Limited" ARE allowed if used factually.)

INDUSTRY TERM REPLACEMENTS:
- PPG → "Free Gratuities"
- OBC → "Onboard Credit"
- PP → "Per Person"

JSON OUTPUT RULES:
1. Return a JSON array that MIRRORS the input exactly (same number of vendors, same number of deals per vendor).
2. Extract "startDate" and "endDate" in MM/DD/YYYY format from the text. If a date looks suspicious or malformed, set it to null and add "dateNote": "possible typo: [original text]".
3. Do NOT include the expiry date in the headline or description (the app handles that automatically).
4. Do NOT include the vendor name in the headline or description.

INPUT DATA:
`;

  groups.forEach((g, i) => {
    promptText += `\nVENDOR ${i+1}: ${g.name}\n`;
    g.deals.forEach((d, j) => {
      // FIX: Don't prepend (EXCLUSIVE) if originalText already starts with EXCLUSIVE
      const alreadyLabeled = /^\s*EXCLUSIVE\b/i.test(d.originalText);
      const prefix = (d.isExclusive && !alreadyLabeled) ? '(EXCLUSIVE) ' : '';
      promptText += `   Deal ${j+1}: ${prefix}${d.originalText}\n`;
    });
  });

  promptText += `
OUTPUT JSON FORMAT:
[
  {
    "vendorIndex": 1,
    "deals": [
      { "headline": "...", "description": "...", "startDate": "MM/DD/YYYY or null", "endDate": "MM/DD/YYYY or null", "dateNote": "optional, only if date looks suspicious" }
    ]
  }
]`;

  return promptText;
}

// --- Validation: catch AI embellishments and suspicious output ---

function extractWords(text) {
  return new Set(
    (text || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

// Words the AI can use even if not in source — harmless connectors, verbs, generic travel terms
const ALLOWED_AI_WORDS = new Set([
  // Verbs & connectors (sentence construction, not factual)
  'book', 'now', 'your', 'next', 'enjoy', 'receive', 'save', 'savings',
  'exclusive', 'limited', 'time', 'offer', 'available', 'today', 'free',
  'for', 'the', 'and', 'with', 'plus', 'get', 'off', 'take', 'advantage',
  'featuring', 'providing', 'features', 'provides', 'includes', 'include',
  'offers', 'offering', 'promotion', 'deal', 'deals',
  // Action words
  'inquire', 'enhance', 'plan', 'discover', 'bring', 'celebrate',
  // Generic travel context
  'onboard', 'credit', 'per', 'person', 'gratuities', 'call', 'agent',
  'details', 'special', 'rates', 'rate', 'pricing', 'during',
  'guests', 'guest', 'stays', 'stay', 'hotel', 'resort',
  'package', 'packages', 'flight', 'booking', 'bookings', 'members',
  'properties', 'participating', 'upcoming', 'amenities',
  'guided', 'tour', 'tours', 'adventures', 'second',
  'cruise', 'vacation', 'select', 'sailings', 'sailing',
  'fares', 'fare', 'voyage', 'getaway', 'trip',
  // Filler that's fine
  'way', 'ease', 'quickly', 'soon', 'more',
]);

// Promo/rate code patterns
const CODE_PATTERN = /\b[A-Z]{2,}\d{1,}[A-Z]*\b|\b[A-Z]\d[A-Z]\b|\bpromo\s*code\b/i;
const RATE_CODE_PATTERN = /\([A-Z0-9]{2,6}\)/;

function validateDeal(aiDeal, rawDeal) {
  const warnings = [];
  const headline = aiDeal.headline || '';
  const description = aiDeal.description || '';
  const combined = headline + ' ' + description;
  const sourceWords = extractWords(rawDeal.originalText);
  const aiWords = extractWords(combined);

  // Check for AI-added words not in source
  const suspicious = [];
  for (const word of aiWords) {
    if (!sourceWords.has(word) && !ALLOWED_AI_WORDS.has(word)) {
      suspicious.push(word);
    }
  }
  if (suspicious.length > 0) {
    warnings.push({
      type: 'embellishment',
      severity: 'warn',
      msg: `AI may have added words not in source: "${suspicious.join('", "')}"`,
    });
  }

  // Check for promo/rate codes in output
  if (CODE_PATTERN.test(combined) || RATE_CODE_PATTERN.test(combined)) {
    warnings.push({
      type: 'code',
      severity: 'error',
      msg: 'Output contains what looks like a promo/rate code. These must be removed.',
    });
  }

  // Check for dateNote from AI
  if (aiDeal.dateNote) {
    warnings.push({
      type: 'date',
      severity: 'error',
      msg: `AI flagged a date issue: ${aiDeal.dateNote}`,
      needsInput: true,
    });
  }

  // Check if source date text looks malformed
  if (aiDeal.endDate) {
    const sourceText = rawDeal.originalText.toLowerCase();
    const dateMatches = sourceText.match(/\d{1,2}\/\d{1,2}\/([a-z]\d|\d[a-z])/);
    if (dateMatches) {
      warnings.push({
        type: 'date',
        severity: 'error',
        msg: `Source has possible date typo: "${dateMatches[0]}". AI may have guessed the date. Please verify.`,
        needsInput: true,
      });
    }
  }

  // Check headline length
  const headlineWords = headline.split(/\s+/).filter(Boolean).length;
  if (headlineWords > 14) {
    warnings.push({ type: 'length', severity: 'warn', msg: `Headline is ${headlineWords} words (target: 8-12).` });
  }

  // Check description length
  const descWords = description.split(/\s+/).filter(Boolean).length;
  if (descWords > 18) {
    warnings.push({ type: 'length', severity: 'warn', msg: `Description is ${descWords} words (target: 10-16).` });
  }

  // Check exclusives start with EXCLUSIVE:
  if (rawDeal.isExclusive && !headline.startsWith('EXCLUSIVE:')) {
    warnings.push({ type: 'format', severity: 'error', msg: 'Exclusive deal headline must start with "EXCLUSIVE: ".' });
  }

  return warnings;
}

// --- Description suffix: 30-day rule ---

function buildFinalDescription(baseDescription, endDateStr) {
  let desc = (baseDescription || "MISSING DESCRIPTION").trim();
  if (!/[.!?]$/.test(desc)) desc += '.';

  if (!endDateStr || typeof endDateStr !== 'string') {
    // Ongoing or no date
    desc += ' Call to speak with an agent!';
    return desc;
  }

  const parts = endDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!parts) {
    desc += ' Call to speak with an agent!';
    return desc;
  }

  let year = parseInt(parts[3], 10);
  if (parts[3].length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
  const endDate = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const now = new Date();
  const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    const shortDate = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    desc += ` Ends ${shortDate}.`;
  } else {
    desc += ' Call to speak with an agent!';
  }

  return desc;
}

// --- Main validate & merge ---

export function validateAndMerge(rawGroups, jsonInput) {
  const aiGroups = cleanAndParseJSON(jsonInput);

  if (rawGroups.length !== aiGroups.length) {
    return {
      error: {
        title: "Vendor Count Mismatch",
        msg: `You provided ${rawGroups.length} vendors, but AI returned ${aiGroups.length}.`,
      }
    };
  }

  const errors = [];
  const allWarnings = [];

  const mergedData = rawGroups.map((rawGroup, idx) => {
    const aiGroup = aiGroups[idx];

    if (rawGroup.deals.length !== aiGroup.deals.length) {
      errors.push(`Vendor "${rawGroup.name}": Sent ${rawGroup.deals.length} deals, got ${aiGroup.deals.length}.`);
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

      const finalDescription = buildFinalDescription(aiDeal.description, aiDeal.endDate);

      return {
        headline: aiDeal.headline || "MISSING HEADLINE",
        description: finalDescription,
        startDate: aiDeal.startDate,
        endDate: aiDeal.endDate,
        dateNote: aiDeal.dateNote || null,
        originalText: rawDeal.originalText,
        isExclusive: rawDeal.isExclusive,
        warnings,
        checked: false
      };
    });

    return { name: rawGroup.name, deals: mergedDeals };
  });

  if (errors.length > 0) {
    return {
      error: {
        title: "Deal Count Mismatch",
        msg: "The AI dropped or added deals. Please fix JSON or Regenerate.",
        details: errors
      }
    };
  }

  return { data: mergedData, warnings: allWarnings };
}
