// =============================================================================
// SINGLE SOURCE OF TRUTH: Supplier list from Dealtag (confirmed up-to-date)
// Both Dealtag and Dedupe import from here. No more drift.
// =============================================================================

export const suppliers = [
  {name: "Abercrombie & Kent", url: "abercrombie-kent", cats: ["tour"]},
  {name: "Adventures by Disney", url: "adventures-by-disney", cats: ["dis", "tour"]},
  {name: "African Travel", url: "african-travel", cats: ["tour"]},
  {name: "Ama Waterways", url: "ama", cats: ["riv"]},
  {name: "American Airline Vacations", url: "american-airline-vacations", cats: ["res"]},
  {name: "American Cruise Line", url: "american-cruise-line", cats: ["lux", "riv"]},
  {name: "Atlantis Paradise Island Bahamas", url: "atlantis", cats: ["res"]},
  {name: "Atlas Ocean Voyages", url: "atlas", cats: ["lux"]},
  {name: "Aulani, A Disney Resort & Spa", url: "disney-aulani", cats: ["dis", "res"]},
  {name: "Avalon Waterways", url: "avalon", cats: ["riv"]},
  {name: "Azamara", url: "azamara", cats: ["lux"]},
  {name: "Beaches", url: "beaches", cats: ["res"]},
  {name: "BlueSky Tours", url: "bluesky-tours", cats: ["tour"]},
  {name: "Breathless", url: "breathless", cats: ["res"]},
  {name: "Carnival", url: "carnival", cats: ["pop"]},
  {name: "Celebrity Cruises", url: "celebrity", cats: ["pop"]},
  {name: "CIE Tours", url: "cie", cats: ["tour"]},
  {name: "Club Med", url: "club-med", cats: ["res"]},
  {name: "Collette", url: "collette", cats: ["tour"]},
  {name: "Costa Cruises", url: "costa", cats: ["pop"]},
  {name: "CroisiEurope", url: "croisieurope", cats: ["riv"]},
  {name: "Crystal Cruises", url: "crystal", cats: ["lux"]},
  {name: "Cunard", url: "cunard", cats: ["lux"]},
  {name: "Delta Vacations", url: "delta-vacations", cats: ["res"]},
  {name: "Disney Cruise Line", url: "disney-cruise-line", cats: ["pop", "dis"]},
  {name: "Disneyland", url: "disneyland", cats: ["dis", "res"]},
  {name: "DisneyWorld", url: "disneyworld", cats: ["dis", "res"]},
  {name: "Dreams", url: "dreams", cats: ["res"]},
  {name: "El Dorado Spa Resorts & Hotels", url: "el-dorado", cats: ["res"]},
  {name: "Emerald Cruises", url: "emerald", cats: ["lux"]},
  {name: "Excellence Resorts", url: "excellence", cats: ["res"]},
  {name: "Explora Journeys", url: "explora", cats: ["lux"]},
  {name: "Four Seasons Yachts", url: "four-seasons-yachts", cats: ["lux"]},
  {name: "Funjet", url: "funjet", cats: ["res"]},
  {name: "G Adventures", url: "g-adventures", cats: ["tour"]},
  {name: "Globus Journeys", url: "globus", cats: ["tour"]},
  {name: "Great Safaris", url: "great-safaris", cats: ["tour"]},
  {name: "Hard Rock Hotels", url: "hardrock", cats: ["res"]},
  {name: "Holland America Line", url: "holland-america", cats: ["pop"]},
  {name: "HX Expeditions", url: "hurtigruten", cats: ["adv"]},
  {name: "Iberostar Hotels & Resorts", url: "iberostar", cats: ["res"]},
  {name: "Karisma Hotels & Resorts", url: "karisma", cats: ["res"]},
  {name: "Lindblad Expeditions & National Geographic", url: "lindblad-national-geographic", cats: ["adv"]},
  {name: "Meet & Greet Italy", url: "meet-and-greet-italy", cats: ["tour"]},
  {name: "Melia", url: "melia", cats: ["res"]},
  {name: "MSC Cruises", url: "msc", cats: ["pop"]},
  {name: "Norwegian", url: "norwegian", cats: ["pop"]},
  {name: "Oceania Cruises", url: "oceania", cats: ["lux"]},
  {name: "Outrigger Hotels & Resorts", url: "outrigger", cats: ["res"]},
  {name: "Palace Resorts", url: "palace-resorts", cats: ["res"]},
  {name: "Paul Gauguin Cruises", url: "paul-gauguin", cats: ["lux"]},
  {name: "Ponant", url: "ponant", cats: ["lux"]},
  {name: "Princess", url: "princess", cats: ["pop"]},
  {name: "Regent Seven Seas Cruises", url: "regent", cats: ["lux"]},
  {name: "Ritz-Carlton Yacht Collection", url: "ritz-carlton-yacht-collection", cats: ["lux"]},
  {name: "RIU Hotels & Resorts", url: "riu", cats: ["res"]},
  {name: "Riverside Cruises", url: "riverside", cats: ["riv"]},
  {name: "Riviera River Cruises", url: "riviera", cats: ["riv"]},
  {name: "Roadtrips", url: "roadtrips", cats: ["tour"]},
  {name: "Rocky Mountaineer", url: "rocky-mountaineer", cats: ["tour", "rail"]},
  {name: "Royal Caribbean", url: "royal-caribbean", cats: ["pop"]},
  {name: "Sandals", url: "sandals", cats: ["res"]},
  {name: "Scenic Eclipse Ocean Voyages", url: "scenic-eclipse", cats: ["lux", "adv"]},
  {name: "Scenic River", url: "scenic", cats: ["riv"]},
  {name: "Seabourn", url: "seabourn", cats: ["lux"]},
  {name: "Secrets", url: "secrets", cats: ["res"]},
  {name: "Silversea", url: "silversea", cats: ["lux"]},
  {name: "Southwest Vacations", url: "southwest-vacations", cats: ["res"]},
  {name: "Star Clippers", url: "star-clippers", cats: ["lux"]},
  {name: "Tauck Cruises", url: "tauck-cruises", cats: ["lux"]},
  {name: "Tauck Tours", url: "tauck-tours", cats: ["tour", "riv"]},
  {name: "Trafalgar", url: "trafalgar", cats: ["tour"]},
  {name: "UnCruise Adventures", url: "uncruise", cats: ["adv"]},
  {name: "United Vacations", url: "united-vacations", cats: ["res"]},
  {name: "Uniworld", url: "uniworld", cats: ["riv"]},
  {name: "Viking Ocean", url: "viking-ocean", cats: ["lux", "adv"]},
  {name: "Viking River", url: "viking-river", cats: ["riv"]},
  {name: "Villas of Distinction", url: "villas-of-distinction", cats: ["res"]},
  {name: "Virgin Voyages", url: "virgin", cats: ["pop"]},
  {name: "Windstar", url: "windstar", cats: ["lux"]},
  {name: "Zo\u00ebtry Wellness & Spa Resorts", url: "zoetry", cats: ["res"]}
].sort((a,b) => a.name.localeCompare(b.name));

// Aliases: map informal/short names to canonical supplier names
// Merged from both Dealtag and Dedupe — covers both tools' needs
export const aliases = new Map(Object.entries({
  // Cruise lines
  "msc": "MSC Cruises",
  "msc cruises": "MSC Cruises",
  "celebrity": "Celebrity Cruises",
  "celebrity cruises": "Celebrity Cruises",
  "holland": "Holland America Line",
  "holland america": "Holland America Line",
  "holland america line": "Holland America Line",
  "rcl": "Royal Caribbean",
  "rccl": "Royal Caribbean",
  "rcc": "Royal Caribbean",
  "royal": "Royal Caribbean",
  "royal caribbean": "Royal Caribbean",
  "ncl": "Norwegian",
  "norwegian cruise line": "Norwegian",
  "norwegian cruise": "Norwegian",
  "oceania": "Oceania Cruises",
  "oceania cruises": "Oceania Cruises",
  "paul gauguin": "Paul Gauguin Cruises",
  "paul gauguin cruises": "Paul Gauguin Cruises",
  "regent": "Regent Seven Seas Cruises",
  "regent seven seas": "Regent Seven Seas Cruises",
  "seven seas": "Regent Seven Seas Cruises",
  "carnival": "Carnival",
  "carnival cruise": "Carnival",
  "carnival cruises": "Carnival",
  "carnival cruise line": "Carnival",
  "princess": "Princess",
  "princess cruises": "Princess",
  "disney cruise": "Disney Cruise Line",
  "disney cruises": "Disney Cruise Line",
  "disney cruise line": "Disney Cruise Line",
  "virgin": "Virgin Voyages",
  "virgin voyages": "Virgin Voyages",
  "virgin cruise": "Virgin Voyages",
  "cunard": "Cunard",
  "seabourn": "Seabourn",
  "seabourn cruises": "Seabourn",
  "silversea": "Silversea",
  "silversea cruises": "Silversea",
  "crystal": "Crystal Cruises",
  "crystal cruises": "Crystal Cruises",
  "azamara": "Azamara",
  "ponant": "Ponant",
  "windstar": "Windstar",
  "windstar cruises": "Windstar",
  "costa": "Costa Cruises",
  "costa cruises": "Costa Cruises",
  "explora": "Explora Journeys",
  "explora journeys": "Explora Journeys",
  "emerald": "Emerald Cruises",
  "emerald cruises": "Emerald Cruises",
  "star clippers": "Star Clippers",
  "ritz-carlton": "Ritz-Carlton Yacht Collection",
  "ritz carlton": "Ritz-Carlton Yacht Collection",
  "four seasons": "Four Seasons Yachts",
  "four seasons yachts": "Four Seasons Yachts",

  // River cruise
  "avalon": "Avalon Waterways",
  "avalon waterways": "Avalon Waterways",
  "amawaterways": "Ama Waterways",
  "ama waterways": "Ama Waterways",
  "ama": "Ama Waterways",
  "croisieurope": "CroisiEurope",
  "croisi europe": "CroisiEurope",
  "riverside": "Riverside Cruises",
  "riverside cruises": "Riverside Cruises",
  "riviera": "Riviera River Cruises",
  "riviera river": "Riviera River Cruises",
  "riviera river cruises": "Riviera River Cruises",
  "uniworld": "Uniworld",
  "uniworld cruises": "Uniworld",
  "scenic river": "Scenic River",
  "scenic": "Scenic River",

  // Viking (all map to canonical names from supplier list)
  "viking": "Viking Ocean",
  "viking cruises": "Viking Ocean",
  "viking ocean": "Viking Ocean",
  "viking river": "Viking River",

  // Expedition
  "hurtigruten": "HX Expeditions",
  "hx": "HX Expeditions",
  "hx expeditions": "HX Expeditions",
  "lindblad": "Lindblad Expeditions & National Geographic",
  "lindblad expeditions": "Lindblad Expeditions & National Geographic",
  "national geographic": "Lindblad Expeditions & National Geographic",
  "atlas": "Atlas Ocean Voyages",
  "atlas ocean": "Atlas Ocean Voyages",
  "atlas ocean voyages": "Atlas Ocean Voyages",
  "uncruise": "UnCruise Adventures",

  // Resorts
  "sandals": "Sandals",
  "beaches": "Beaches",
  "breathless": "Breathless",
  "club med": "Club Med",
  "clubmed": "Club Med",
  "el dorado": "El Dorado Spa Resorts & Hotels",
  "dreams": "Dreams",
  "excellence": "Excellence Resorts",
  "hard rock": "Hard Rock Hotels",
  "hard rock hotels": "Hard Rock Hotels",
  "iberostar": "Iberostar Hotels & Resorts",
  "karisma": "Karisma Hotels & Resorts",
  "outrigger": "Outrigger Hotels & Resorts",
  "palace": "Palace Resorts",
  "palace resorts": "Palace Resorts",
  "riu": "RIU Hotels & Resorts",
  "secrets": "Secrets",
  "villas": "Villas of Distinction",
  "villas of distinction": "Villas of Distinction",
  "zoetry": "Zo\u00ebtry Wellness & Spa Resorts",
  "zo\u00ebtry": "Zo\u00ebtry Wellness & Spa Resorts",
  "melia": "Melia",
  "atlantis": "Atlantis Paradise Island Bahamas",
  "funjet": "Funjet",

  // Airlines vacations
  "american airlines vacations": "American Airline Vacations",
  "american airline vacations": "American Airline Vacations",
  "delta": "Delta Vacations",
  "delta vacations": "Delta Vacations",
  "southwest": "Southwest Vacations",
  "southwest vacations": "Southwest Vacations",
  "united": "United Vacations",
  "united vacations": "United Vacations",

  // Disney
  "disney world": "DisneyWorld",
  "walt disney world": "DisneyWorld",
  "disneyland": "Disneyland",
  "aulani": "Aulani, A Disney Resort & Spa",
  "adventures by disney": "Adventures by Disney",

  // Tours
  "bluesky": "BlueSky Tours",
  "cie": "CIE Tours",
  "cie tours": "CIE Tours",
  "collette": "Collette",
  "globus": "Globus Journeys",
  "globus journeys": "Globus Journeys",
  "g adventures": "G Adventures",
  "trafalgar": "Trafalgar",
  "tauck": "Tauck Cruises",
  "tauck cruises": "Tauck Cruises",
  "tauck tours": "Tauck Tours",
  "rocky mountaineer": "Rocky Mountaineer",
  "roadtrips": "Roadtrips",
  "meet and greet italy": "Meet & Greet Italy",
  "african travel": "African Travel",
  "great safaris": "Great Safaris",
  "abercrombie": "Abercrombie & Kent",
  "abercrombie and kent": "Abercrombie & Kent",

  // American Cruise Line
  "american cruise": "American Cruise Line",
  "american cruise line": "American Cruise Line",
}));

// Vendor family grouping for Dedupe matching
// Brands that should match against each other share a family key
// BUG FIX: Viking overrides are AFTER the spread so they actually take effect
export const familyOf = {
  // Base: every supplier is its own family by default
  ...Object.fromEntries(suppliers.map(s => [s.name, norm(s.name)])),
  // Override: group Viking brands together
  "Viking Ocean": "viking",
  "Viking River": "viking",
  // Override: normalize naming variations
  "Princess": "princess",
  "Princess Cruises": "princess",
  "Norwegian": "norwegian",
  "Norwegian Cruise Line": "norwegian",
  "Carnival": "carnival",
  "Carnival Cruise Line": "carnival",
  "HX Expeditions": "hx expeditions",
  "Hurtigruten": "hx expeditions",
  "Scenic Eclipse Ocean Voyages": "scenic",
  "Scenic River": "scenic",
};

// --- Shared utilities ---

export function norm(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Resolve any input string to a canonical supplier name
export function canonicalVendor(input) {
  if (!input) return null;
  const n = norm(input.replace(/:$/, ''));
  // Direct alias lookup
  const aliased = aliases.get(n);
  if (aliased) return aliased;
  // Direct match against supplier list
  const byNorm = suppliers.find(s => norm(s.name) === n);
  if (byNorm) return byNorm.name;
  // Fuzzy fallback: keyword matching
  if (/\bviking\b/.test(n)) return 'Viking Ocean';
  if (/\bncl\b|\bnorwegian\b/.test(n)) return 'Norwegian';
  if (/\broyal\b|\brccl?\b/.test(n)) return 'Royal Caribbean';
  if (/\bprincess\b/.test(n)) return 'Princess';
  if (/\bcarnival\b/.test(n)) return 'Carnival';
  if (/\bmsc\b/.test(n)) return 'MSC Cruises';
  if (/\bholland\b/.test(n)) return 'Holland America Line';
  if (/\bcelebrity\b/.test(n)) return 'Celebrity Cruises';
  if (/\bvirgin\b/.test(n)) return 'Virgin Voyages';
  if (/\boceania\b/.test(n)) return 'Oceania Cruises';
  if (/\bseabourn\b/.test(n)) return 'Seabourn';
  if (/\bsilversea\b/.test(n)) return 'Silversea';
  if (/\bcrystal\b/.test(n)) return 'Crystal Cruises';
  if (/\bazamara\b/.test(n)) return 'Azamara';
  if (/\bcunard\b/.test(n)) return 'Cunard';
  if (/\bavalon\b/.test(n)) return 'Avalon Waterways';
  if (/\bama\b/.test(n)) return 'Ama Waterways';
  if (/\briviera\b/.test(n)) return 'Riviera River Cruises';
  if (/\buniworld\b/.test(n)) return 'Uniworld';
  if (/\bscenic\b/.test(n)) return 'Scenic River';
  if (/\bhurtigruten\b|\bhx\b/.test(n)) return 'HX Expeditions';
  return input.trim();
}

export function vendorFamily(name) {
  const c = canonicalVendor(name);
  return familyOf[c] || norm(c);
}

// Supplier name list for quick lookups
export const supplierNames = suppliers.map(s => s.name);
