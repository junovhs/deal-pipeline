Yes. This is the right architecture. The current app’s failures are not “frontend bugs”; they are boundary bugs caused by letting text formats, UI state, and business rules bleed into each other. The criticism doc already points at the same root cause: the matcher is still too threshold-driven, the copy linter is word-diff based, and the text format is doing too much structural work.

The way to take this home is: **freeze the UI as an operator workflow, move the pipeline into a typed deterministic Rust core, then make every meaningful behavior fixture-backed before polishing screens.**

## Target architecture

Keep the web app responsible for:

- session state
- step navigation
- file upload
- operator review screens
- copy editing and patching
- persisted local work-in-progress
- display of explanations, warnings, and candidate choices

Move all pipeline truth into `deal-core`:

```txt
deal-core/
  src/
    lib.rs
    parser.rs
    suppliers.rs
    facts.rs
    dedupe.rs
    decision.rs
    copy_lint.rs
    fixtures.rs
    types.rs
  fixtures/
    weekly/
    suppliers/
    lint/
  tests/
```

Expose a narrow WASM API:

```ts
parseRawEmail(rawText): ParseResult
tagRawEmail(rawText, options): TagResult
ingestWebsiteDeals(jsonRows): WebsiteIngestResult
resolveSuppliers(records): SupplierResolutionResult
extractFacts(records): FactExtractionResult
scoreCandidates(hqDeals, websiteDeals): CandidateScoringResult
decideMatches(scoredCandidates, policy): MatchDecisionResult
lintCopy(rawDeals, aiCopy): CopyLintResult
runFixtureSuite(fixtureBundle): FixtureReport
```

The UI should never know how to score, normalize, parse dates, detect jargon, or decide whether something is safe. It should only render core outputs and collect operator decisions.

## The core data model

The current app still has multiple intermediate shapes: tagged text, HQ parsed rows, website rows, raw copy groups, AI JSON, patched deals. That is why position-based merge and delimiter inconsistencies keep showing up. The criticism doc explicitly recommends one canonical `DealRecord` carrying raw source, canonical vendor, facts, dedupe outcome, copy result, warnings, approval state, and notes.

In Rust, make that real.

```rust
pub struct DealRecord {
    pub id: DealId,
    pub source: DealSource,
    pub raw_text: String,
    pub tag: DealTag,
    pub supplier: SupplierResolution,
    pub facts: DealFacts,
    pub dates: DateFacts,
    pub provenance: Provenance,
}
```

Core enums should replace stringly-typed status flags:

```rust
pub enum DealTag {
    VendorHeading,
    StandardDeal,
    ExclusiveDeal,
    UnknownLine,
}

pub enum SupplierStatus {
    Known { canonical: SupplierId },
    Ambiguous { candidates: Vec<SupplierId>, preferred: Option<SupplierId> },
    RecognizedButIneligible { canonical: SupplierId },
    Unknown,
}

pub enum MatchDecision {
    AutoMatch { candidate_id: CandidateId },
    Review { candidates: Vec<ScoredCandidate>, blockers: Vec<Blocker> },
    AutoUnmatched { reason: UnmatchedReason },
    Extension { candidate_id: CandidateId, reason: ExtensionReason },
}
```

That is the difference between “the app seems to work” and “the pipeline cannot silently confuse a supplier class again.”

## Phase 1: Stabilize the contract before rewriting logic

Do not start by rewriting the entire matcher. Start by defining the contract the Rust core must satisfy.

Create `deal-core/schemas/` or generated TS bindings for:

- `RawInput`
- `TaggedOutput`
- `DealRecord`
- `SupplierResolution`
- `DealFacts`
- `WebsiteDeal`
- `ScoredCandidate`
- `MatchDecision`
- `CopyLintFinding`
- `FixtureReport`

Then mirror those in TypeScript:

```ts
export type CoreResult<T> =
  | { ok: true; data: T; diagnostics: CoreDiagnostic[] }
  | { ok: false; error: CoreError; diagnostics: CoreDiagnostic[] };
```

Every WASM call should return structured data plus diagnostics. No throwing for normal messy input. Messy input is expected; the core should report it.

A hard rule: **WASM returns JSON-compatible structs only. React never receives raw Rust internals.**

## Phase 2: Port parser and supplier resolution first

The parser and supplier resolver are the highest-leverage first Rust modules because they define identity and provenance. The current parser emits tab-delimited output, while the criticism document calls out delimiter inconsistency as a reliability bug. The exported code also shows `parseHQ` matching only tab-separated tags, while Quick Add emits space-separated `v ...` / `d ...` lines.

Rust parser requirements:

- accept tabs, spaces, and pasted mixed formats
- normalize internally to typed records
- preserve original line text
- emit diagnostics for ignored lines
- never silently drop a line without a diagnostic
- maintain stable IDs independent of array position

Supplier resolver requirements:

- separate recognition from workflow eligibility
- represent ambiguity explicitly
- preserve family grouping separately from exact supplier
- make every alias auditable
- test every supplier alias and ineligible supplier fixture

This module should produce:

```rust
pub struct ParsedBatch {
    pub records: Vec<DealRecord>,
    pub diagnostics: Vec<ParseDiagnostic>,
    pub stats: ParseStats,
}
```

No downstream module should ever parse tagged text again.

## Phase 3: Build fact extraction as the real backbone

This is where the project becomes solid.

The criticism doc’s strongest recommendation is to stop relying on feature bags and word novelty, and instead extract structured facts: benefit type, amount, unit, qualifiers, audience, geography, deal family, hidden/public nature, dates, and product scope.

Define facts like this:

```rust
pub struct DealFacts {
    pub benefits: Vec<BenefitFact>,
    pub amounts: Vec<AmountFact>,
    pub audiences: Vec<AudienceFact>,
    pub scopes: Vec<ScopeFact>,
    pub geography: Vec<GeoFact>,
    pub deal_family: Vec<DealFamily>,
    pub exclusivity: ExclusivityFact,
    pub internal_terms: Vec<InternalTerm>,
}

pub enum BenefitKind {
    OnboardCredit,
    Gratuities,
    Deposit,
    Dining,
    Airfare,
    ResortCredit,
    SpaCredit,
    KidsFree,
    FreeNight,
    Amenity,
    Discount,
    Upgrade,
    HiddenFare,
    NoPerkRate,
}
```

The output should not merely say “found obc.” It should say:

```json
{
  "kind": "OnboardCredit",
  "amount": { "value": 100, "unit": "USD" },
  "scope": ["Balcony & Above"],
  "confidence": "high",
  "sourceSpan": [34, 42]
}
```

Spans matter because the UI can highlight exactly why the core believes something.

## Phase 4: Replace threshold matching with candidate review policy

The current design still thinks in terms of a selected match plus score. The correct design is:

1. generate candidates
2. score candidates
3. apply blockers
4. apply decision policy
5. return top candidates and explanation

The criticism doc explicitly calls for high-confidence auto-match, low-confidence auto-unmatch, and a human review middle band.

Rust should separate these:

```rust
pub fn generate_candidates(hq: &[DealRecord], web: &[WebsiteDeal]) -> Vec<CandidatePair>;

pub fn score_candidate(pair: CandidatePair) -> ScoredCandidate;

pub fn decide_match(
    deal: &DealRecord,
    candidates: &[ScoredCandidate],
    policy: &DecisionPolicy,
) -> MatchDecision;
```

Hard blockers should be first-class:

```rust
pub enum Blocker {
    SupplierMismatch,
    BenefitClassMismatch,
    AmountConflict,
    AudienceConflict,
    GeographyConflict,
    HiddenFarePublicRateConflict,
    DateConflict,
}
```

The UI should not decide “matched vs unmatched” by threshold. It should render the Rust decision:

```ts
switch (decision.kind) {
  case "AutoMatch":
  case "Review":
  case "AutoUnmatched":
  case "Extension":
}
```

That single change eliminates a whole class of fragile UI behavior.

## Phase 5: Rewrite copy lint as fact validation

The current copy validator is still fundamentally word-diff based: it extracts words from source and AI output, compares them against an allowlist, and emits embellishment warnings. The criticism doc correctly says this is noisy and still misses factual drift.

Rust copy lint should compare source facts to output facts:

```rust
pub struct CopyLintFinding {
    pub rule_id: RuleId,
    pub severity: LintSeverity,
    pub message: String,
    pub source_fact: Option<FactRef>,
    pub output_fact: Option<FactRef>,
    pub advice: String,
}

pub enum LintSeverity {
    Blocker,
    Review,
    Info,
}
```

Blockers:

- invented amount
- invented date
- invented percent
- invented destination
- invented audience
- leaked promo/rate code
- missing `EXCLUSIVE:`
- suspicious guessed date
- hidden fare exposed as public wording

Review:

- added benefit noun
- added scope qualifier
- internal jargon not rewritten
- ambiguous supplier/fact not resolved

Info:

- stylistic filler
- harmless paraphrase
- headline length/style issues

The UI then becomes much simpler: show Blocker and Review by default; hide Info unless requested.

Also move `buildFinalDescription` behavior out of hidden post-processing. The criticism doc flags the current suffix behavior as risky because final copy is partly AI-written and partly recomputed at runtime. In the new model, suffix becomes explicit data:

```rust
pub enum DescriptionSuffix {
    EndsDate { date: NaiveDate },
    CallAgent,
    None,
    OperatorSelected(String),
}
```

## Phase 6: Fixture validation becomes the gate, not an afterthought

This should be the main “done” definition.

The criticism doc recommends 8–12 historical HQ inputs, corresponding website JSON, expected match outcomes, expected copy warnings, and correct patch examples. I would make that the backbone of the repo.

Suggested fixture layout:

```txt
deal-core/fixtures/
  weekly/
    2026-05-26/
      raw-email.txt
      website-deals.json
      expected-tagged.json
      expected-deal-records.json
      expected-matches.json
      expected-copy-lint.json
      notes.md
  suppliers/
    supplier-resolution.json
    supplier-eligibility.json
  parser/
    delimiter-tolerance.json
    malformed-dates.json
  lint/
    internal-jargon.json
    invented-amounts.json
    exclusive-format.json
```

Rust test categories:

```txt
cargo test parser
cargo test suppliers
cargo test facts
cargo test dedupe
cargo test decision
cargo test copy_lint
cargo test fixtures
```

Then root scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "core:test": "cargo test --manifest-path deal-core/Cargo.toml",
    "core:wasm": "wasm-pack build deal-core --target web --out-dir ../src/wasm/deal-core",
    "test": "npm run typecheck && npm run core:test && npm run core:wasm && npm run build"
  }
}
```

“Done” means `npm test` passes, not “I clicked through and it seemed fine.”

## Phase 7: WASM boundary design

Keep the WASM boundary coarse-grained. Do not call Rust for tiny UI interactions like every keystroke. Call it at pipeline transitions.

Good WASM calls:

```ts
core.parseAndTag(rawText, options);
core.ingestWebsiteDeals(rows);
core.runDedupe(parsedDeals, websiteDeals, policy);
core.lintCopy(dealRecords, aiCopy);
core.validateFixtureBundle(bundle);
```

Bad WASM calls:

```ts
core.isThisOneWordSuspicious(word)
core.scoreOneChip(...)
core.normalizeOneSupplierOnEveryKeypress(...)
```

The React app should cache core outputs in session state:

```ts
type PipelineSession = {
  rawEmail: string;
  parsedBatch?: ParsedBatch;
  websiteRows: unknown[];
  websiteBatch?: WebsiteBatch;
  dedupeRun?: DedupeRun;
  copyRun?: CopyValidationRun;
  operatorDecisions: Record<DealId, OperatorDecision>;
};
```

The UI owns `operatorDecisions`; Rust owns the recommended decision and explanation.

## Phase 8: Migration sequence

Do not big-bang the whole app.

### Milestone 1 — Rust crate skeleton

Deliverables:

- `deal-core` crate
- shared types
- serde support
- fixture runner
- WASM build
- TypeScript wrapper

Acceptance:

- Rust compiles
- WASM imports in Vite
- one smoke test passes from TS

### Milestone 2 — Parser and supplier resolver

Deliverables:

- Rust parser accepts mixed delimiters
- supplier catalog ported
- tag eligibility ported
- ambiguity/ineligible/unknown represented as enums
- current supplier regression fixtures pass

Acceptance:

- no silent line drops
- supplier confusion fixture passes
- JS parser path can be disabled behind a feature flag

### Milestone 3 — Fact extraction

Deliverables:

- benefit facts
- amount facts
- audience facts
- scope/geography facts
- internal term detection
- source spans

Acceptance:

- facts match expected fixture JSON
- UI can show extracted facts per deal

### Milestone 4 — Dedupe engine

Deliverables:

- candidate generation
- scoring explanations
- hard blockers
- exact supplier bonus
- high/review/low policy
- top 3 candidates

Acceptance:

- current weekly fixtures produce expected AutoMatch / Review / AutoUnmatched decisions
- React no longer categorizes matches by score threshold

### Milestone 5 — Copy lint engine

Deliverables:

- fact extraction from final copy
- Blocker / Review / Info severities
- internal jargon rules
- promo/rate code rules
- exclusive format rules
- date hallucination rules

Acceptance:

- word-diff embellishment warning removed or demoted
- copy gate blocks only Blockers
- Info hidden by default

### Milestone 6 — Operator correction log

Deliverables:

- exportable NDJSON correction log
- records source deal, candidates, scores, selected action, notes
- import previous correction logs as optional tuning fixtures

Acceptance:

- every manual override becomes reusable data
- no database required yet

## What not to do

Do not rewrite the UI first. The UI is not the core problem.

Do not move session state into Rust. Rust should not know about panels, tabs, modals, localStorage, or whether a card is expanded.

Do not introduce Postgres yet. The criticism doc is right: storage will not make the matcher smarter or the linter less noisy. It becomes useful later for multi-user history, analytics, and persistent labeled decisions.

Do not expose low-level Rust functions directly to React. Keep a stable API layer so you can change internals without touching every screen.

## The “rock solid” definition

This project is ready when:

1. every raw line is either parsed or diagnosed;
2. every supplier is Known, Ambiguous, RecognizedButIneligible, or Unknown;
3. every deal has stable identity from raw input through copy validation;
4. every match decision is AutoMatch, Review, AutoUnmatched, or Extension;
5. every auto-match has no blockers;
6. every copy warning has a rule ID, severity, source fact, and advice;
7. fixture tests cover historical messy weeks;
8. React cannot override core truth accidentally;
9. operator overrides are logged;
10. one root command validates Rust, WASM, TypeScript, fixtures, and production build.

That is the right endgame: **React/Vite/TypeScript as the workflow console; Rust/WASM as the deterministic deal engine.**
