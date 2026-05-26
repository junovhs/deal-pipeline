// =============================================================================
// SHARED SUPPLIER NORMALIZATION
// One auditable catalog feeds both Dealtag and Dedupe.
// =============================================================================

const SUPPLIER_CATALOG = [
  { name: "Abercrombie & Kent", url: "abercrombie-kent", cats: ["tour"] },
  { name: "Adventures by Disney", url: "adventures-by-disney", cats: ["dis", "tour"] },
  { name: "African Travel", url: "african-travel", cats: ["tour"] },
  { name: "ALG Vacations", url: "alg-vacations", cats: ["res"] },
  { name: "Ama Waterways", url: "ama", cats: ["riv"] },
  { name: "American Airline Vacations", url: "american-airline-vacations", cats: ["res"] },
  { name: "American Cruise Line", url: "american-cruise-line", cats: ["lux", "riv"] },
  { name: "Atlantis Paradise Island Bahamas", url: "atlantis", cats: ["res"] },
  { name: "Atlas Ocean Voyages", url: "atlas", cats: ["lux"] },
  { name: "Aulani, A Disney Resort & Spa", url: "disney-aulani", cats: ["dis", "res"] },
  { name: "Avalon Waterways", url: "avalon", cats: ["riv"] },
  { name: "Avanti", url: "avanti", cats: ["tour", "res"] },
  { name: "Azamara", url: "azamara", cats: ["lux"] },
  { name: "Beaches", url: "beaches", cats: ["res"] },
  { name: "Bedsonline", url: "bedsonline", cats: ["res"] },
  { name: "BlueSky Tours", url: "bluesky-tours", cats: ["tour"] },
  { name: "Breathless", url: "breathless", cats: ["res"] },
  { name: "Brightline", url: "brightline", cats: ["rail"] },
  { name: "Carnival", url: "carnival", cats: ["pop"] },
  { name: "Celebrity Cruises", url: "celebrity", cats: ["pop"] },
  { name: "CIE Tours", url: "cie", cats: ["tour"] },
  { name: "Classic Vacations", url: "classic-vacations", cats: ["res"] },
  { name: "Club Med", url: "club-med", cats: ["res"] },
  { name: "Collette", url: "collette", cats: ["tour"] },
  { name: "Costa Cruises", url: "costa", cats: ["pop"] },
  { name: "CroisiEurope", url: "croisieurope", cats: ["riv"] },
  { name: "Crystal Cruises", url: "crystal", cats: ["lux"] },
  { name: "Cunard", url: "cunard", cats: ["lux"] },
  { name: "Delta Vacations", url: "delta-vacations", cats: ["res"] },
  { name: "Disney Cruise Line", url: "disney-cruise-line", cats: ["pop", "dis"] },
  { name: "Disneyland", url: "disneyland", cats: ["dis", "res"] },
  { name: "DisneyWorld", url: "disneyworld", cats: ["dis", "res"] },
  { name: "Dreams", url: "dreams", cats: ["res"] },
  { name: "El Dorado Spa Resorts & Hotels", url: "el-dorado", cats: ["res"] },
  { name: "Emerald Cruises", url: "emerald", cats: ["lux"] },
  { name: "Excellence Resorts", url: "excellence", cats: ["res"] },
  { name: "Explora Journeys", url: "explora", cats: ["lux"] },
  { name: "Four Seasons Yachts", url: "four-seasons-yachts", cats: ["lux"] },
  { name: "Funjet", url: "funjet", cats: ["res"] },
  { name: "G Adventures", url: "g-adventures", cats: ["tour"] },
  { name: "Globus Journeys", url: "globus", cats: ["tour"] },
  { name: "Great Safaris", url: "great-safaris", cats: ["tour"] },
  { name: "Hard Rock Hotels", url: "hardrock", cats: ["res"] },
  { name: "Holland America Line", url: "holland-america", cats: ["pop"] },
  { name: "HX Expeditions", url: "hurtigruten", cats: ["adv"] },
  { name: "Iberostar Hotels & Resorts", url: "iberostar", cats: ["res"] },
  { name: "Karisma Hotels & Resorts", url: "karisma", cats: ["res"] },
  { name: "Lindblad Expeditions & National Geographic", url: "lindblad-national-geographic", cats: ["adv"] },
  { name: "Margaritaville at Sea", url: "margaritaville-at-sea", cats: ["pop"] },
  { name: "Meet & Greet Italy", url: "meet-and-greet-italy", cats: ["tour"] },
  { name: "Melia", url: "melia", cats: ["res"] },
  { name: "MSC Cruises", url: "msc", cats: ["pop"] },
  { name: "Norwegian", url: "norwegian", cats: ["pop"] },
  { name: "Oceania Cruises", url: "oceania", cats: ["lux"] },
  { name: "Outrigger Hotels & Resorts", url: "outrigger", cats: ["res"] },
  { name: "Palace Resorts", url: "palace-resorts", cats: ["res"] },
  { name: "Paul Gauguin Cruises", url: "paul-gauguin", cats: ["lux"] },
  { name: "Pleasant Holidays", url: "pleasant-holidays", cats: ["res"] },
  { name: "Ponant", url: "ponant", cats: ["lux"] },
  { name: "Princess", url: "princess", cats: ["pop"] },
  { name: "Regent Seven Seas Cruises", url: "regent", cats: ["lux"] },
  { name: "Ritz-Carlton Yacht Collection", url: "ritz-carlton-yacht-collection", cats: ["lux"] },
  { name: "RIU Hotels & Resorts", url: "riu", cats: ["res"] },
  { name: "Riverside Cruises", url: "riverside", cats: ["riv"] },
  { name: "Riviera River Cruises", url: "riviera", cats: ["riv"] },
  { name: "Roadtrips", url: "roadtrips", cats: ["tour"] },
  { name: "Rocky Mountaineer", url: "rocky-mountaineer", cats: ["tour", "rail"] },
  { name: "Royal Caribbean", url: "royal-caribbean", cats: ["pop"] },
  { name: "Sandals", url: "sandals", cats: ["res"] },
  { name: "Scenic Eclipse Ocean Voyages", url: "scenic-eclipse", cats: ["lux", "adv"] },
  { name: "Scenic River", url: "scenic", cats: ["riv"] },
  { name: "Seabourn", url: "seabourn", cats: ["lux"] },
  { name: "Secrets", url: "secrets", cats: ["res"] },
  { name: "Silversea", url: "silversea", cats: ["lux"] },
  { name: "Southwest Vacations", url: "southwest-vacations", cats: ["res"] },
  { name: "Star Clippers", url: "star-clippers", cats: ["lux"] },
  { name: "Tauck Cruises", url: "tauck-cruises", cats: ["lux"] },
  { name: "Tauck Tours", url: "tauck-tours", cats: ["tour", "riv"] },
  { name: "Trafalgar", url: "trafalgar", cats: ["tour"] },
  { name: "UnCruise Adventures", url: "uncruise", cats: ["adv"] },
  { name: "United Vacations", url: "united-vacations", cats: ["res"] },
  { name: "Uniworld", url: "uniworld", cats: ["riv"] },
  { name: "Viator", url: "viator", cats: ["tour"] },
  { name: "Viking Ocean", url: "viking-ocean", cats: ["lux", "adv"] },
  { name: "Viking River", url: "viking-river", cats: ["riv"] },
  { name: "Villas of Distinction", url: "villas-of-distinction", cats: ["res"] },
  { name: "Virgin Voyages", url: "virgin", cats: ["pop"] },
  { name: "Windstar", url: "windstar", cats: ["lux"] },
  { name: "Zoëtry Wellness & Spa Resorts", url: "zoetry", cats: ["res"] },
].sort((a, b) => a.name.localeCompare(b.name));

const SUPPLIER_ALIASES = {
  "Abercrombie & Kent": ["abercrombie", "abercrombie and kent"],
  "Adventures by Disney": ["adventures by disney"],
  "African Travel": ["african travel"],
  "ALG Vacations": ["alg vacations", "algv", "luxe by alg vacations"],
  "Ama Waterways": ["ama", "ama waterways", "amawaterways"],
  "American Airline Vacations": ["american airline vacations", "american airlines vacations"],
  "American Cruise Line": ["american cruise", "american cruise line"],
  "Atlantis Paradise Island Bahamas": ["atlantis"],
  "Atlas Ocean Voyages": ["atlas", "atlas ocean", "atlas ocean voyages"],
  "Aulani, A Disney Resort & Spa": ["aulani"],
  "Avalon Waterways": ["avalon", "avalon waterways"],
  Avanti: ["avanti", "avanti insider tours"],
  Azamara: ["azamara"],
  Beaches: ["beaches"],
  Bedsonline: ["bedsonline"],
  "BlueSky Tours": ["bluesky"],
  Breathless: ["breathless"],
  Brightline: ["brightline"],
  Carnival: ["carnival", "carnival cruise", "carnival cruises", "carnival cruise line"],
  "Celebrity Cruises": ["celebrity", "celebrity cruises"],
  "CIE Tours": ["cie", "cie tours"],
  "Classic Vacations": ["classic vacations"],
  "Club Med": ["club med", "clubmed"],
  Collette: ["collette"],
  "Costa Cruises": ["costa", "costa cruises"],
  CroisiEurope: ["croisieurope", "croisi europe"],
  "Crystal Cruises": ["crystal", "crystal cruises"],
  Cunard: ["cunard"],
  "Delta Vacations": ["delta", "delta vacations"],
  "Disney Cruise Line": ["disney cruise", "disney cruises", "disney cruise line"],
  Disneyland: ["disneyland"],
  DisneyWorld: ["disney world", "walt disney world"],
  Dreams: ["dreams"],
  "El Dorado Spa Resorts & Hotels": ["el dorado"],
  "Emerald Cruises": ["emerald", "emerald cruises"],
  "Excellence Resorts": ["excellence"],
  "Explora Journeys": ["explora", "explora journeys"],
  "Four Seasons Yachts": ["four seasons", "four seasons yachts"],
  Funjet: ["funjet"],
  "G Adventures": ["g adventures"],
  "Globus Journeys": ["globus", "globus journeys"],
  "Great Safaris": ["great safaris"],
  "Hard Rock Hotels": ["hard rock", "hard rock hotels"],
  "Holland America Line": ["holland", "holland america", "holland america line"],
  "HX Expeditions": ["hx", "hx expeditions", "hurtigruten"],
  "Iberostar Hotels & Resorts": ["iberostar"],
  "Karisma Hotels & Resorts": ["karisma"],
  "Lindblad Expeditions & National Geographic": [
    "lindblad",
    "lindblad expeditions",
    "national geographic",
  ],
  "Margaritaville at Sea": ["margaritaville at sea"],
  "Meet & Greet Italy": ["meet and greet italy"],
  Melia: ["melia"],
  "MSC Cruises": ["msc", "msc cruises"],
  Norwegian: ["ncl", "norwegian", "norwegian cruise", "norwegian cruise line"],
  "Oceania Cruises": ["oceania", "oceania cruises"],
  "Outrigger Hotels & Resorts": ["outrigger"],
  "Palace Resorts": ["palace", "palace resorts"],
  "Paul Gauguin Cruises": ["paul gauguin", "paul gauguin cruises"],
  "Pleasant Holidays": ["pleasant holidays"],
  Ponant: ["ponant"],
  Princess: ["princess", "princess cruises"],
  "Regent Seven Seas Cruises": ["regent", "regent seven seas", "seven seas"],
  "Ritz-Carlton Yacht Collection": ["ritz carlton", "ritz-carlton"],
  "RIU Hotels & Resorts": ["riu"],
  "Riverside Cruises": ["riverside", "riverside cruises"],
  "Riviera River Cruises": ["riviera", "riviera river", "riviera river cruises"],
  Roadtrips: ["roadtrips"],
  "Rocky Mountaineer": ["rocky mountaineer"],
  "Royal Caribbean": ["rcc", "rcl", "rccl", "royal", "royal caribbean"],
  Sandals: ["sandals"],
  "Scenic Eclipse Ocean Voyages": ["scenic eclipse", "scenic eclipse ocean voyages"],
  "Scenic River": ["scenic", "scenic river"],
  Seabourn: ["seabourn", "seabourn cruises"],
  Secrets: ["secrets"],
  Silversea: ["silversea", "silversea cruises"],
  "Southwest Vacations": ["southwest", "southwest vacations"],
  "Star Clippers": ["star clippers"],
  "Tauck Cruises": ["tauck cruises"],
  "Tauck Tours": ["tauck tours"],
  Trafalgar: ["trafalgar"],
  "UnCruise Adventures": ["uncruise"],
  "United Vacations": ["united", "united vacations"],
  Uniworld: ["uniworld", "uniworld cruises"],
  Viator: ["viator"],
  "Viking Ocean": ["viking cruises", "viking ocean"],
  "Viking River": ["viking river"],
  "Villas of Distinction": ["villas", "villas of distinction"],
  "Virgin Voyages": ["virgin", "virgin cruise", "virgin voyages"],
  Windstar: ["windstar", "windstar cruises"],
  "Zoëtry Wellness & Spa Resorts": ["zoetry", "zoëtry"],
};

const SUPPLIER_FAMILIES = [
  { key: "scenic", members: ["Scenic Eclipse Ocean Voyages", "Scenic River"] },
  { key: "tauck", members: ["Tauck Cruises", "Tauck Tours"] },
  { key: "viking", members: ["Viking Ocean", "Viking River"] },
];

const SUPPLIER_AMBIGUITIES = [
  {
    label: "disney",
    candidates: [
      "Adventures by Disney",
      "Aulani, A Disney Resort & Spa",
      "Disney Cruise Line",
      "DisneyWorld",
      "Disneyland",
    ],
  },
  {
    label: "scenic emerald cruises",
    candidates: ["Emerald Cruises", "Scenic River"],
  },
  {
    label: "tauck",
    candidates: ["Tauck Cruises", "Tauck Tours"],
    family: "tauck",
    preferredCanonicalName: "Tauck Cruises",
  },
  {
    label: "viking",
    candidates: ["Viking Ocean", "Viking River"],
    family: "viking",
    preferredCanonicalName: "Viking Ocean",
  },
];

const SUPPLIER_KEYWORD_RULES = [
  { pattern: /\bhx\b|\bhurtigruten\b/, canonicalName: "HX Expeditions" },
  { pattern: /\bmargaritaville at sea\b/, canonicalName: "Margaritaville at Sea" },
  { pattern: /\bncl\b|\bnorwegian\b/, canonicalName: "Norwegian" },
  { pattern: /\broyal\b|\brccl?\b/, canonicalName: "Royal Caribbean" },
];

export function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanVendorInput(input) {
  return (input || "")
    .replace(/^•\s*/, "")
    .replace(/:$/, "")
    .trim();
}

export const supplierCatalog = SUPPLIER_CATALOG.map((entry) => ({
  ...entry,
  family: norm(entry.name),
}));

export const suppliers = supplierCatalog.map(({ name, url, cats }) => ({ name, url, cats }));

const catalogByName = new Map(supplierCatalog.map((entry) => [entry.name, entry]));
const catalogByNormName = new Map(supplierCatalog.map((entry) => [norm(entry.name), entry]));

export const aliases = new Map();
for (const [canonicalName, rawAliases] of Object.entries(SUPPLIER_ALIASES)) {
  if (!catalogByName.has(canonicalName)) {
    throw new Error(`Alias target is not in supplier catalog: ${canonicalName}`);
  }
  for (const rawAlias of rawAliases) {
    aliases.set(norm(rawAlias), canonicalName);
  }
}

export const familyOf = Object.fromEntries(
  supplierCatalog.map((entry) => [entry.name, norm(entry.name)]),
);
for (const family of SUPPLIER_FAMILIES) {
  for (const member of family.members) {
    familyOf[member] = family.key;
  }
}

const ambiguousByLabel = new Map();
for (const ambiguity of SUPPLIER_AMBIGUITIES) {
  ambiguousByLabel.set(norm(ambiguity.label), {
    ...ambiguity,
    family:
      ambiguity.family ||
      (() => {
        const familyKeys = [...new Set(ambiguity.candidates.map((name) => familyOf[name]))];
        return familyKeys.length === 1 ? familyKeys[0] : null;
      })(),
  });
}

function buildKnownResolution(entry, rawInput, normalizedInput, matchedBy) {
  return {
    rawInput,
    normalizedInput,
    status: "known",
    canonicalName: entry.name,
    familyKey: familyOf[entry.name] || norm(entry.name),
    matchedBy,
    candidates: [entry.name],
  };
}

function buildAmbiguousResolution(ambiguity, rawInput, normalizedInput, matchedBy) {
  return {
    rawInput,
    normalizedInput,
    status: "ambiguous",
    canonicalName: ambiguity.preferredCanonicalName || ambiguity.candidates[0] || null,
    familyKey: ambiguity.family || null,
    matchedBy,
    candidates: [...ambiguity.candidates],
  };
}

function buildUnknownResolution(rawInput, normalizedInput) {
  return {
    rawInput,
    normalizedInput,
    status: "unknown",
    canonicalName: null,
    familyKey: null,
    matchedBy: "unknown",
    candidates: [],
  };
}

export function resolveVendor(input) {
  const rawInput = cleanVendorInput(input);
  if (!rawInput) {
    return buildUnknownResolution(rawInput, "");
  }

  const normalizedInput = norm(rawInput);

  const directAmbiguity = ambiguousByLabel.get(normalizedInput);
  if (directAmbiguity) {
    return buildAmbiguousResolution(directAmbiguity, rawInput, normalizedInput, "ambiguous-alias");
  }

  const directCatalog = catalogByNormName.get(normalizedInput);
  if (directCatalog) {
    return buildKnownResolution(directCatalog, rawInput, normalizedInput, "canonical");
  }

  const directAlias = aliases.get(normalizedInput);
  if (directAlias) {
    return buildKnownResolution(
      catalogByName.get(directAlias),
      rawInput,
      normalizedInput,
      "alias",
    );
  }

  for (const rule of SUPPLIER_KEYWORD_RULES) {
    if (rule.pattern.test(normalizedInput)) {
      return buildKnownResolution(
        catalogByName.get(rule.canonicalName),
        rawInput,
        normalizedInput,
        "keyword",
      );
    }
  }

  return buildUnknownResolution(rawInput, normalizedInput);
}

export function canonicalVendor(input) {
  const resolution = resolveVendor(input);
  return resolution.canonicalName || cleanVendorInput(input) || null;
}

export function vendorFamily(name) {
  const resolution = resolveVendor(name);
  return resolution.familyKey || norm(resolution.canonicalName || cleanVendorInput(name));
}

export const supplierNames = suppliers.map((supplier) => supplier.name);
