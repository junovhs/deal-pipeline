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

`package-lock.json`
Implements package-lock functionality. data.

`scripts/run-regression-fixtures.js`
Implements run-regression-fixtures functionality.
Semantic: async
Evidence:
- async/await usage in `main` (L38-L204)
- async/await usage in `readFixture` (L24-L26)
- module-level const `__dirname` (L19)
- module-level const `fixtureDir` (L20-L22)
- persistence pattern in `readFixture` (L24-L26)

`src/App.tsx`
Support file for the src subsystem.
Semantic: error-swallowing
Evidence:
- module-level const `STEPS` (L8-L12)
- module-level const `STORAGE_KEY` (L14)
- swallowed-error site in `App` (L65-L277)

`src/components/CopywritingStep.tsx`
Support file for the components subsystem. [QUALITY:complex-flow,syntax-degraded]
Evidence:
- module-level mutable static `confettiFn` (L13)
- module-level mutable static `confettiLoaded` (L12)

`src/components/DealtagStep.tsx`
Implements dealtag step.
Exports: DealtagStep, default

`src/components/DedupeStep.tsx`
Support file for the components subsystem. [QUALITY:complex-flow]
Semantic: async
Evidence:
- async/await usage in `DedupeStep` (L13-L346)

`src/logic/copywriting.js`
Validates and merge. [HOTSPOT] [QUALITY:undocumented]
Exports: appendDealToRawInput, cleanAndParsePatchJSON, parseRawToGroups, cleanAndParseJSON
Evidence:
- module-level const `ALLOWED_AI_WORDS` (L202-L282)
- module-level const `CODE_PATTERN` (L284-L285)
- module-level const `DEFAULT_HOUSE_STYLE` (L11-L54)
- module-level const `RATE_CODE_PATTERN` (L286)

`src/logic/dealCoreClient.ts`
Parses raw email. [QUALITY:undocumented]
Exports: parseRawEmail, loadDealCore, WebsiteExportBatch, validateWebsiteExport
Semantic: async
Evidence:
- async/await usage in `loadDealCore` (L33-L35)
- async/await usage in `parseRawEmail` (L37-L83)
- async/await usage in `validateWebsiteExport` (L92-L97)

`src/logic/dealtag.js`
Implements transform functionality. [HOTSPOT] [QUALITY:complex-flow]
Exports: transform
Evidence:
- module-level const `DATE_RE` (L10)
- module-level const `DEAL_CUES` (L12)
- module-level const `DEAL_MARKER` (L11)
- module-level const `SECTION_HEADING` (L9)

`src/logic/dedupe.js`
Parses hq dates. [HOTSPOT] [QUALITY:undocumented,complex-flow]
Exports: ingestWebsiteJSON, runFullMatch, parseHQDates, dateFmt
Evidence:
- module-level const `FEATURE_PATTERNS` (L89-L113)
- module-level const `FEATURE_WEIGHTS` (L142-L148)
- module-level const `IGNORE_FEATURES` (L140)
- module-level const `TEXT_STOPS` (L150-L154)
- module-level const `dateFmt` (L165-L167)
- module-level mutable static `nextId` (L537)

`src/logic/suppliers.js`
Implements supplier catalog. [HOTSPOT] [QUALITY:undocumented]
Exports: isTagEligibleSupplier, familyOf, canonicalVendor, resolveVendor
Evidence:
- module-level const `SUPPLIER_ALIASES` (L98-L192)
- module-level const `SUPPLIER_AMBIGUITIES` (L201-L233)
- module-level const `SUPPLIER_CATALOG` (L6-L96)
- module-level const `SUPPLIER_FAMILIES` (L194-L199)
- module-level const `SUPPLIER_KEYWORD_RULES` (L235-L240)
- module-level const `TAG_INELIGIBLE_SUPPLIERS` (L242-L249)
- module-level const `aliases` (L279)
- module-level const `ambiguousByLabel` (L298)
- 6 more detector facts omitted from SEMMAP.md

`src/vite-env.d.ts`
Placeholder file.

`src/wasm/deal-core/deal_core.d.ts`
Creates output. [QUALITY:undocumented]
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
Implements wbindgen externrefs. [HOTSPOT] [QUALITY:undocumented]
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

`src/App.css`
Implements app functionality. styles.


## DependencyGraph

```yaml
DependencyGraph:
  # --- Entrypoints ---
  App.css:
    Imports: []
    ImportedBy: []
  # --- High Fan-In Hotspots ---
  copywriting.js:
    Imports: []
    ImportedBy: [App.tsx, CopywritingStep.tsx, run-regression-fixtures.js]
  dealtag.js:
    Imports: [suppliers.js]
    ImportedBy: [DealtagStep.tsx, run-regression-fixtures.js]
  dedupe.js:
    Imports: [suppliers.js]
    ImportedBy: [DedupeStep.tsx, run-regression-fixtures.js]
  suppliers.js:
    Imports: []
    ImportedBy: [dealtag.js, dedupe.js, run-regression-fixtures.js]
  # --- Layer 0 -- Config ---
  AGENTS.md, CLAUDE.md, SEMMAP.md, criticism.md, north-star.md, package.json, tsconfig.json, vite.config.js:
    Imports: []
    ImportedBy: []
  # --- Layer 1 -- Domain (Engine) ---
  App.tsx:
    Imports: [CopywritingStep.tsx, DealtagStep.tsx, DedupeStep.tsx, copywriting.js, dealCoreClient.ts, deal_core_bg.wasm.d.ts]
    ImportedBy: []
  CopywritingStep.tsx:
    Imports: [DealtagStep.tsx, copywriting.js]
    ImportedBy: [App.tsx]
  DealtagStep.tsx:
    Imports: [dealtag.js]
    ImportedBy: [App.tsx, CopywritingStep.tsx]
  DedupeStep.tsx:
    Imports: [dealCoreClient.ts, deal_core_bg.wasm.d.ts, dedupe.js]
    ImportedBy: [App.tsx]
  dealCoreClient.ts:
    Imports: [deal_core.js]
    ImportedBy: [App.tsx, DedupeStep.tsx]
  package-lock.json, vite-env.d.ts:
    Imports: []
    ImportedBy: []
  run-regression-fixtures.js:
    Imports: [copywriting.js, dealtag.js, dedupe.js, suppliers.js]
    ImportedBy: []
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
