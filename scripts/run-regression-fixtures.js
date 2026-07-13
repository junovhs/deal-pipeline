import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { transform } from "../src/logic/dealtag.js";
import {
  ingestWebsiteJSON,
  parseHQ,
  resetIds,
  runFullMatch,
} from "../src/logic/dedupe.js";
import { resolveVendor } from "../src/logic/suppliers.js";
import {
  parseRawToGroups,
  validateAndMerge,
} from "../src/logic/copywriting.js";
import {
  initSync as initDealCoreSync,
  validateWebsiteExport as validateWebsiteExportWasm,
} from "../src/wasm/deal-core/deal_core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = process.env.FIXTURE_DIR
  ? path.resolve(process.env.FIXTURE_DIR)
  : path.join(__dirname, "..", "fixtures", "regression");

async function readFixture(name) {
  return readFile(path.join(fixtureDir, name), "utf8");
}

function findMatch(matches, vendor) {
  const match = matches.find((row) => row.hq.vendor === vendor);
  assert.ok(match, `Expected a dedupe result for ${vendor}.`);
  return match;
}

function collectWarningTypes(warnings) {
  return warnings.map((warning) => warning.type).sort();
}

async function main() {
  const rawPromo = await readFixture("raw-promo-email-sample.txt");
  const weeklyRawPromo = await readFixture("raw-promo-email.txt");
  const websiteRows = JSON.parse(await readFixture("website-deals.json"));
  const aiResponse = await readFixture("ai-response.txt");
  const supplierResolutions = JSON.parse(await readFixture("supplier-resolution.json"));

  const wasmBytes = await readFile(path.join(
    __dirname,
    "..",
    "src",
    "wasm",
    "deal-core",
    "deal_core_bg.wasm",
  ));
  initDealCoreSync({ module: wasmBytes });
  const validatedWebsite = validateWebsiteExportWasm(websiteRows);
  assert.equal(validatedWebsite.ok, true);
  assert.equal(validatedWebsite.data.recognizedCount, websiteRows.length);
  assert.equal(validatedWebsite.data.rows[0].shopOverline, "Norwegian Cruise Line");
  assert.equal(validatedWebsite.data.rows[0].title, "Free Gratuities for 2");
  assert.equal(validatedWebsite.data.rows[0] instanceof Map, false);

  const tagged = transform(rawPromo, { includeUnknowns: true });
  const taggedLines = tagged.text.split("\n");
  assert.deepEqual(tagged.stats, {
    vendors: 3,
    deals: 3,
    excl: 1,
    ambiguousSuppliers: 0,
    unknownSuppliers: 1,
    lines: 10,
  });
  assert.deepEqual(taggedLines, [
    "v\tNCL",
    "ed\tEXCLUSIVE: Free Gratuities for 2 + $100 OBC ends 06/15/26",
    "v\tRoyal Caribbean",
    "d\tKids Sail Free + up to $500 OBC ends 07/20/26",
    "v\tCarnival",
    "d\tSave 20% off cruise fares ends 05/10/q7",
    "X\tMystery Escapes",
    "X\tSave $200 on select sailings ends 08/01/26",
  ]);

  const weeklyTagged = transform(weeklyRawPromo, { includeUnknowns: true });
  assert.deepEqual(weeklyTagged.stats, {
    vendors: 29,
    deals: 89,
    excl: 39,
    ambiguousSuppliers: 2,
    unknownSuppliers: 8,
    lines: 276,
  });

  const supplierStructureRaw = `
Margaritaville at Sea
America's Summer Sale 50% off Select Sailings: Ends 8/25/2026
Lindblad/National Geographic Expeditions:
50% Reduced Deposit on Select Sailings: Ends 8/18/2026
Top Land Offers
AIC Hotel Group
â€¢            Hard Rock
              Up to 55% and $200 Resort Credit at Hard Rock Hotels. Ends 7/31/26
              Hard Rock Groups - Complimentary Rooms, Private Functions & Upgrades
â€¢            UNICO
              Summer Instant Savings - Save $100 per night. Ends 8/15/26
ALGV
â€¢            Luxe by ALG Vacations - Save up to 50%. End date varies by resort.
â€¢            Blue Sky Tours
              Save Up to $700 on Hawaii Vacation Packages. Ends 7/30/26
The Palace Company
â€¢            Up to 35% Off at Palace Resorts. Ends 7/31/26
â€¢            Baglioni
              Up to 25% Off at Baglioni Maldives. Ends 7/31/26
â€¢            Le Blanc
              Up to 20% Off. Ends 7/31/26
Railbookers
â€¢            Up to $500 Off. Ends 7/18/26
Sandals
â€¢            Black Friday in July - Up to 65% Off. Ends 7/27/26`;
  const supplierStructureTagged = transform(supplierStructureRaw, { includeUnknowns: true });
  assert.deepEqual(supplierStructureTagged.text.split("\n"), [
    "X\tMargaritaville at Sea",
    "X\tAmerica's Summer Sale 50% off Select Sailings: Ends 8/25/2026",
    "v\tLindblad/National Geographic Expeditions",
    "d\t50% Reduced Deposit on Select Sailings: Ends 8/18/2026",
    "X\tAIC Hotel Group",
    "v\tHard Rock",
    "d\tUp to 55% and $200 Resort Credit at Hard Rock Hotels. Ends 7/31/26",
    "d\tHard Rock Groups - Complimentary Rooms, Private Functions & Upgrades",
    "X\tUNICO",
    "X\tSummer Instant Savings - Save $100 per night. Ends 8/15/26",
    "X\tALGV",
    "X\tLuxe by ALG Vacations - Save up to 50%. End date varies by resort.",
    "X\tBlue Sky Tours",
    "X\tSave Up to $700 on Hawaii Vacation Packages. Ends 7/30/26",
    "v\tThe Palace Company",
    "d\tUp to 35% Off at Palace Resorts. Ends 7/31/26",
    "X\tBaglioni",
    "X\tUp to 25% Off at Baglioni Maldives. Ends 7/31/26",
    "X\tLe Blanc",
    "X\tUp to 20% Off. Ends 7/31/26",
    "X\tRailbookers",
    "X\tUp to $500 Off. Ends 7/18/26",
    "v\tSandals",
    "d\tBlack Friday in July - Up to 65% Off. Ends 7/27/26",
  ]);

  for (const [label, canonicalName, tagEligible] of [
    ["ALGV", "ALG Vacations", false],
    ["Blue Sky Tours", "BlueSky Tours", false],
    ["Lindblad/National Geographic Expeditions:", "Lindblad Expeditions & National Geographic", true],
    ["Margaritaville at Sea", "Margaritaville at Sea", false],
    ["The Palace Company", "Palace Resorts", true],
  ]) {
    const resolution = resolveVendor(label);
    assert.equal(resolution.canonicalName, canonicalName, `Unexpected canonical supplier for ${label}`);
    assert.equal(resolution.tagEligible, tagEligible, `Unexpected tag eligibility for ${label}`);
  }

  resetIds();
  const hqDeals = parseHQ(tagged.text);
  assert.equal(hqDeals.length, 4);
  assert.deepEqual(
    hqDeals.map((deal) => ({
      vendor: deal.vendor,
      type: deal.type,
      hasEndDate: Boolean(deal.end),
    })),
    [
      { vendor: "Norwegian", type: "exclusive", hasEndDate: true },
      { vendor: "Royal Caribbean", type: "deal", hasEndDate: true },
      { vendor: "Carnival", type: "deal", hasEndDate: true },
      { vendor: "Mystery Escapes", type: "deal", hasEndDate: true },
    ],
  );

  const websiteDeals = ingestWebsiteJSON(websiteRows);
  assert.deepEqual(
    websiteDeals.map((deal) => ({
      supplier: deal.supplier,
      supplierStatus: deal.supplierStatus,
      vendorFamily: deal.vendorFamily,
    })),
    [
      { supplier: "Norwegian", supplierStatus: "known", vendorFamily: "norwegian" },
      { supplier: "Royal Caribbean", supplierStatus: "known", vendorFamily: "royal caribbean" },
    ],
  );

  for (const fixture of supplierResolutions) {
    const actual = resolveVendor(fixture.label);
    assert.equal(actual.status, fixture.status, `Unexpected status for ${fixture.label}`);
    assert.equal(
      actual.canonicalName ?? null,
      fixture.canonicalName,
      `Unexpected canonical supplier for ${fixture.label}`,
    );
    assert.equal(
      actual.familyKey ?? null,
      fixture.familyKey,
      `Unexpected family key for ${fixture.label}`,
    );
    assert.equal(actual.matchedBy, fixture.matchedBy, `Unexpected match mode for ${fixture.label}`);
    if (Object.hasOwn(fixture, "tagEligible")) {
      assert.equal(
        actual.tagEligible,
        fixture.tagEligible,
        `Unexpected tag eligibility for ${fixture.label}`,
      );
    }
    if (fixture.candidates) {
      assert.deepEqual(actual.candidates, fixture.candidates, `Unexpected candidates for ${fixture.label}`);
    }
  }

  const matches = runFullMatch(hqDeals, websiteDeals);
  assert.equal(matches.length, 4);

  const norwegianMatch = findMatch(matches, "Norwegian");
  assert.equal(norwegianMatch.web?.supplier, "Norwegian");
  assert.ok(
    norwegianMatch.meta.score >= 20,
    `Expected Norwegian alias match to score strongly, got ${norwegianMatch.meta.score}.`,
  );
  assert.ok(
    norwegianMatch.meta.why.some((reason) => reason.text === "obc"),
    "Expected Norwegian alias match to retain onboard-credit reasoning.",
  );
  assert.ok(
    norwegianMatch.meta.stages.some((stage) => stage.key === "features"),
    "Expected Norwegian match to expose feature-stage scoring.",
  );

  const royalMatch = findMatch(matches, "Royal Caribbean");
  assert.equal(royalMatch.web?.supplier, "Royal Caribbean");
  assert.ok(
    royalMatch.meta.score >= 20,
    `Expected Royal Caribbean match to score strongly, got ${royalMatch.meta.score}.`,
  );

  const carnivalMatch = findMatch(matches, "Carnival");
  assert.equal(carnivalMatch.web, null);
  assert.deepEqual(collectWarningTypes(carnivalMatch.meta.why), ["neg"]);
  assert.equal(carnivalMatch.meta.why[0].text, "no web deals");
  assert.deepEqual(carnivalMatch.meta.candidateRankings, []);

  const unknownSupplierMatch = findMatch(matches, "Mystery Escapes");
  assert.equal(unknownSupplierMatch.web, null);
  assert.equal(unknownSupplierMatch.hq.text, "Save $200 on select sailings ends 08/01/26");

  const rawGroups = parseRawToGroups(tagged.text);
  assert.deepEqual(
    rawGroups.map((group) => ({
      name: group.name,
      deals: group.deals.length,
      exclusive: group.deals[0]?.isExclusive ?? false,
    })),
    [
      { name: "NCL", deals: 1, exclusive: true },
      { name: "Royal Caribbean", deals: 1, exclusive: false },
      { name: "Carnival", deals: 1, exclusive: false },
    ],
  );

  const merged = validateAndMerge(rawGroups, aiResponse);
  assert.ok(!merged.error, `Unexpected copy validation error: ${merged.error?.title}`);
  assert.equal(merged.data.length, 3);
  assert.equal(merged.warnings.length, 3);

  const [exclusiveDeal] = merged.data[0].deals;
  assert.deepEqual(collectWarningTypes(exclusiveDeal.warnings), [
    "code",
    "embellishment",
    "format",
  ]);
  assert.match(exclusiveDeal.description, /Ends 6\/15\.$/);

  const [carnivalDeal] = merged.data[2].deals;
  assert.equal(carnivalDeal.dateNote, "possible typo: ends 05/10/q7");
  assert.ok(
    carnivalDeal.warnings.some((warning) => warning.type === "date"),
    "Expected the AI date note to surface as a copy-validation warning.",
  );

  console.log("Tag fixture: PASS");
  console.log(
    `Weekly raw-email fixture: PASS (${weeklyTagged.stats.deals} deals across ${weeklyTagged.stats.vendors} vendors)`,
  );
  console.log("Dedupe fixture: PASS");
  console.log("Supplier resolution fixture: PASS");
  console.log("Copy validation fixture: PASS");
  console.log("All regression fixtures passed.");
}

main().catch((error) => {
  console.error("Regression fixture failure:");
  console.error(error);
  process.exitCode = 1;
});
