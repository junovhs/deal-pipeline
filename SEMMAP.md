# deal-pipeline -- Semantic Map

**Purpose:** A bespoke pipeline that takes a simple list of deals from a weekly Dream Vacations promo email, and takes them all the way to published deals with full copy.

## Legend

`[ENTRY]` Application entry point

`[CORE]` Core business logic

`[TYPE]` Data structures and types

`[UTIL]` Utility functions

`[HOTSPOT]` High fan-in file imported by 4+ others - request this file early in any task

`[GLOBAL-UTIL]` High fan-in utility imported from 3+ distinct domains

`[DOMAIN-CONTRACT]` Shared contract imported mostly by one subsystem

`[ROLE:model]` Primary domain model or state-holding data structure.

`[ROLE:controller]` Coordinates commands, events, or request handling.

`[ROLE:rendering]` Produces visual output or drawing behavior.

`[ROLE:view]` Represents a reusable UI view or presentation component.

`[ROLE:dialog]` Implements dialog-oriented interaction flow.

`[ROLE:config]` Defines configuration loading or configuration schema behavior.

`[ROLE:os-integration]` Bridges the application to OS-specific APIs or services.

`[ROLE:utility]` Provides cross-cutting helper logic without owning core flow.

`[ROLE:bootstrap]` Initializes the application or wires subsystem startup.

`[ROLE:build-only]` Supports the build toolchain rather than runtime behavior.

`[EVIDENCE]` Located detector facts listed under file entries; these are observations, not verdicts.

`[SURFACE:filesystem]` Touches filesystem paths, files, or directory traversal.

`[SURFACE:shell]` Integrates with shell commands, shell UX, or command launch surfaces.

`[SURFACE:clipboard]` Reads from or writes to the system clipboard.

`[SURFACE:http-handler]` Implements HTTP request handling or web endpoint logic.

`[SURFACE:database]` Interacts with database services or ORMs.

`[SURFACE:external-api]` Makes outbound calls to external HTTP APIs or services.

`[SURFACE:cpp:ntfs]` C++/Win32 corpus: uses NTFS-specific filesystem semantics or metadata.

`[SURFACE:cpp:win32]` C++/Win32 corpus: touches Win32 platform APIs or Windows-native handles.

`[SURFACE:cpp:gdi]` C++/Win32 corpus: uses GDI drawing primitives or related graphics APIs.

`[SURFACE:cpp:control]` C++/MFC corpus: represents or manipulates MFC widget/control surfaces.

`[SURFACE:cpp:view]` C++/MFC corpus: represents an MFC CView-level presentation surface.

`[SURFACE:cpp:dialog]` C++/MFC corpus: represents an MFC CDialog interaction surface.

`[SURFACE:cpp:document]` C++/MFC corpus: represents an MFC CDocument editing surface.

`[SURFACE:cpp:frame]` C++/MFC corpus: represents an MFC CFrameWnd application chrome surface.

`[SURFACE:template]` Uses template engines for rendering output.

`[QUALITY:undocumented]` Has public symbols without documentation.

`[QUALITY:complex-flow]` Contains functions with high cognitive complexity.

`[QUALITY:error-boundary]` Concentrated error handling — many panic, swallow, or propagation sites.

`[QUALITY:concurrency-heavy]` Uses multiple concurrency primitives (async, locks, spawn).

`[QUALITY:syntax-degraded]` Parse errors detected — semantic analysis may be incomplete.

## Layer 0 -- Config

`AGENTS.md`
Support file for AGENTS.

`CLAUDE.md`
Support file for CLAUDE.

`SEMMAP.md`
Generated semantic map.

`criticism.md`
Support file for criticism.

`deal-core/Cargo.toml`
Workspace configuration.

`neti.toml`
Configuration for neti.

`north-star.md`
Support file for north-star.

`package.json`
Node.js package manifest.

`src/wasm/deal-core/package.json`
Node.js package manifest.

`tsconfig.json`
Configuration for tsconfig.

`vite.config.js`
Implements vite.config functionality.
Exports: default

## Layer 1 -- Domain (Engine)

`deal-core/src/fixtures.rs`
Executable reports for repository fixtures that exercise public core behavior.
Exports: run_fixture_suite, FixtureCaseReport, FixtureReport.passed, FixtureReport

`deal-core/src/types.rs`
Shared serialized contracts for parser output, diagnostics, provenance, and supplier-resolution uncertainty.
Exports: ParsedLineRecord, CoreDiagnosticKind, SupplierResolution, DealSource

`deal-core/src/website.rs`
Validation boundary for operator-supplied website exports.
Exports: validate_website_export_core, WebsiteExportBatch

`package-lock.json`
Implements package-lock functionality. data.

`scripts/run-regression-fixtures.js`
Implements run-regression-fixtures functionality.
Semantic: async
Evidence:
- async/await usage in `main` (L44-L377)
- async/await usage in `readFixture` (L30-L32)
- module-level const `__dirname` (L25)
- module-level const `fixtureDir` (L26-L28)
- persistence pattern in `main` (L44-L377)
- persistence pattern in `readFixture` (L30-L32)

`src/App.tsx`
Owns the three-step workflow shell and the durable browser session shared by Tag, Dedupe, and Copy.
Exports: App, default
Semantic: error-swallowing
Evidence:
- module-level const `STEPS` (L8-L12)
- module-level const `STORAGE_KEY` (L14)
- swallowed-error site in `App` (L70-L282)

`src/components/CopywritingStep.tsx`
Manages the manual AI-copy workflow from prompt generation through lint review, targeted repair, completion tracking, and field-by-field clipboard handoff. [QUALITY:complex-flow,syntax-degraded]
Exports: CopywritingStep, default
Evidence:
- module-level mutable static `confettiFn` (L14)
- module-level mutable static `confettiLoaded` (L13)

`src/components/DealtagStep.tsx`
Presents raw-email tagging as a reviewable two-pane operation.
Exports: DealtagStep, default

`src/components/DedupeStep.tsx`
Orchestrates website-export validation, supplier-scoped matching, and human review of matched, extension, and unmatched deals. [QUALITY:complex-flow]
Exports: DedupeStep, default
Semantic: async
Evidence:
- async/await usage in `DedupeStep` (L19-L400)

`src/logic/copywriting.js`
Default operator-editable policy embedded in batch and repair prompts. [HOTSPOT]
Exports: appendDealToRawInput, cleanAndParsePatchJSON, parseRawToGroups, cleanAndParseJSON
Evidence:
- module-level const `CODE_PATTERN` (L300-L301)
- module-level const `DEFAULT_HOUSE_STYLE` (L12-L55)
- module-level const `HEADLINE_SCOPE_GROUPS` (L237-L251)
- module-level const `MATERIAL_CLAIM_GROUPS` (L213-L226)
- module-level const `MATERIAL_SCOPE_GROUPS` (L228-L233)
- module-level const `NUMBER_WORDS` (L253-L258)
- module-level const `RATE_CODE_PATTERN` (L302)
- module-level const `SLUG_STOP_WORDS` (L304-L307)

`src/logic/dealCoreClient.ts`
Parses raw email. [HOTSPOT]
Exports: parseRawEmail, loadDealCore, WebsiteExportBatch, validateWebsiteExport
Semantic: async
Evidence:
- async/await usage in `loadDealCore` (L35-L37)
- async/await usage in `parseRawEmail` (L45-L91)
- async/await usage in `validateWebsiteExport` (L107-L112)

`src/logic/dealtag.js`
Converts a raw weekly promotion email into the tagged `v`/`d`/`ed` text consumed by dedupe and copywriting. [QUALITY:complex-flow]
Exports: transform
Evidence:
- module-level const `BULLET_PREFIX` (L13)
- module-level const `DATE_RE` (L10)
- module-level const `DEAL_CUES` (L12)
- module-level const `DEAL_MARKER` (L11)
- module-level const `SECTION_HEADING` (L9)

`src/logic/dedupe.js`
Implements date fmt. [QUALITY:complex-flow]
Exports: ingestWebsiteJSON, runFullMatch, parseHQDates, dateFmt
Evidence:
- module-level const `FEATURE_PATTERNS` (L96-L120)
- module-level const `FEATURE_WEIGHTS` (L149-L155)
- module-level const `IGNORE_FEATURES` (L147)
- module-level const `TEXT_STOPS` (L157-L161)
- module-level const `dateFmt` (L173-L175)
- module-level mutable static `nextId` (L545)

`src/logic/suppliers.js`
Canonical supplier records enriched with the default normalized family key. [HOTSPOT]
Exports: isTagEligibleSupplier, familyOf, canonicalVendor, resolveVendor
Evidence:
- module-level const `SUPPLIER_ALIASES` (L98-L194)
- module-level const `SUPPLIER_AMBIGUITIES` (L203-L235)
- module-level const `SUPPLIER_CATALOG` (L6-L96)
- module-level const `SUPPLIER_FAMILIES` (L196-L201)
- module-level const `SUPPLIER_KEYWORD_RULES` (L237-L242)
- module-level const `TAG_INELIGIBLE_SUPPLIERS` (L244-L254)
- module-level const `aliases` (L293)
- module-level const `ambiguousByLabel` (L313)
- 6 more detector facts omitted from SEMMAP.md

`src/vite-env.d.ts`
Placeholder file.

`src/wasm/deal-core/deal_core.d.ts`
Creates input. [QUALITY:undocumented]
Exports: parseRawEmail, validateWebsiteExport, SyncInitInput, InitOutput

`src/wasm/deal-core/deal_core.js`
Parses raw email. [SURFACE:external-api] [QUALITY:complex-flow]
Exports: parseRawEmail, validateWebsiteExport, initSync
Semantic: async with external API surface
Evidence:
- async/await usage in `__wbg_init` (L492-L516)
- async/await usage in `__wbg_load` (L437-L470)
- external API surface in `__wbg_init` (L492-L516)
- module-level const `MAX_SAFARI_DECODE_BYTES` (L399)
- module-level const `cachedTextEncoder` (L411)
- module-level mutable static `WASM_VECTOR_LEN` (L424)
- module-level mutable static `cachedDataViewMemory0` (L327)
- module-level mutable static `cachedTextDecoder` (L397)
- 5 more detector facts omitted from SEMMAP.md

`src/wasm/deal-core/deal_core_bg.wasm.d.ts`
Implements wbindgen exn store. [HOTSPOT] [QUALITY:undocumented]
Exports: __externref_table_alloc, parseRawEmail, validateWebsiteExport, __wbindgen_exn_store
Evidence:
- module-level const `__externref_table_alloc` (L9)
- module-level const `__wbindgen_exn_store` (L8)
- module-level const `__wbindgen_externrefs` (L10)
- module-level const `__wbindgen_malloc` (L6)
- module-level const `__wbindgen_realloc` (L7)
- module-level const `__wbindgen_start` (L11)
- module-level const `memory` (L3)
- module-level const `parseRawEmail` (L4)
- 1 more detector facts omitted from SEMMAP.md

## Layer 3 -- App / Entrypoints

`deal-core/src/lib.rs`
Deterministic parsing and website-export validation exposed to the browser through a JSON-compatible WASM boundary.
Exports: validate_website_export, parse_raw_email_core, parse_raw_email

`prototypes/import-clean-poc.html`
Deal Intake Lab — Proof of Concept

`src/App.css`
Implements app functionality. styles.


## DependencyGraph

```yaml
DependencyGraph:
  # --- Entrypoints ---
  App.css, import-clean-poc.html:
    Imports: []
    ImportedBy: []
  # --- High Fan-In Hotspots ---
  suppliers.js:
    Imports: []
    ImportedBy: [dealtag.js, dedupe.js]
  # --- Layer 0 -- Config ---
  AGENTS.md, CLAUDE.md, SEMMAP.md, criticism.md, neti.toml, north-star.md, package.json, tsconfig.json, vite.config.js:
    Imports: []
    ImportedBy: []
  # --- Layer 1 -- Domain (Engine) ---
  App.tsx:
    Imports: [CopywritingStep.tsx, DealtagStep.tsx, DedupeStep.tsx, copywriting.js, dealCoreClient.ts, deal_core_bg.wasm.d.ts]
    ImportedBy: []
  CopywritingStep.tsx:
    Imports: [DedupeStep.tsx, copywriting.js]
    ImportedBy: [App.tsx]
  DealtagStep.tsx:
    Imports: [dealtag.js]
    ImportedBy: [App.tsx]
  DedupeStep.tsx:
    Imports: [dealCoreClient.ts, deal_core_bg.wasm.d.ts, dedupe.js]
    ImportedBy: [App.tsx, CopywritingStep.tsx]
  copywriting.js:
    Imports: []
    ImportedBy: [App.tsx, CopywritingStep.tsx]
  dealCoreClient.ts:
    Imports: [deal_core.js]
    ImportedBy: [App.tsx, DedupeStep.tsx, website.rs]
  dealtag.js:
    Imports: [suppliers.js]
    ImportedBy: [DealtagStep.tsx]
  dedupe.js:
    Imports: [suppliers.js]
    ImportedBy: [DedupeStep.tsx]
  package-lock.json, scripts/run-regression-fixtures.js, vite-env.d.ts:
    Imports: []
    ImportedBy: []
  # --- Subproject -- deal-core ---
  deal-core/Cargo.toml:
    Imports: []
    ImportedBy: []
  fixtures.rs:
    Imports: [lib.rs]
    ImportedBy: [lib.rs]
  lib.rs:
    Imports: [fixtures.rs, types.rs, website.rs]
    ImportedBy: [fixtures.rs]
  types.rs:
    Imports: []
    ImportedBy: [lib.rs]
  website.rs:
    Imports: [dealCoreClient.ts]
    ImportedBy: [lib.rs]
  # --- Subproject -- src/wasm/deal-core ---
  deal_core.d.ts, src/wasm/deal-core/package.json:
    Imports: []
    ImportedBy: []
  deal_core.js:
    Imports: [deal_core_bg.wasm.d.ts]
    ImportedBy: [dealCoreClient.ts]
  deal_core_bg.wasm.d.ts:
    Imports: []
    ImportedBy: [App.tsx, DedupeStep.tsx, deal_core.js]
```
