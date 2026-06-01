# CORE-01 -- Semantic Map

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

`[COUPLING:pure]` Logic stays within the language/runtime without external surface coupling.

`[COUPLING:mixed]` Blends pure logic with side effects or boundary interactions.

`[COUPLING:ui-coupled]` Depends directly on UI framework, rendering, or windowing APIs.

`[COUPLING:os-coupled]` Depends directly on operating-system services or platform APIs.

`[COUPLING:build-only]` Only relevant during build, generation, or compilation steps.

`[BEHAVIOR:owns-state]` Maintains durable in-memory state for a subsystem.

`[BEHAVIOR:owns-const-state]` Owns immutable module-level constants without implying mutable runtime state.

`[BEHAVIOR:mutates]` Changes application or model state in response to work.

`[BEHAVIOR:renders]` Produces rendered output, drawing commands, or visual layout.

`[BEHAVIOR:dispatches]` Routes commands, events, or control flow to other units.

`[BEHAVIOR:observes]` Listens to callbacks, notifications, or external signals.

`[BEHAVIOR:persists]` Reads from or writes to durable storage.

`[BEHAVIOR:spawns-worker]` Creates background workers, threads, or async jobs.

`[BEHAVIOR:sync-primitives]` Coordinates execution with locks, channels, or wait primitives.

`[SURFACE:filesystem]` Touches filesystem paths, files, or directory traversal.

`[SURFACE:ntfs]` Uses NTFS-specific filesystem semantics or metadata.

`[SURFACE:win32]` Touches Win32 platform APIs or Windows-native handles.

`[SURFACE:shell]` Integrates with shell commands, shell UX, or command launch surfaces.

`[SURFACE:clipboard]` Reads from or writes to the system clipboard.

`[SURFACE:gdi]` Uses GDI drawing primitives or related graphics APIs.

`[SURFACE:control]` Represents or manipulates widget/control surfaces.

`[SURFACE:view]` Represents a view-level presentation surface.

`[SURFACE:dialog]` Represents a dialog/window interaction surface.

`[SURFACE:document]` Represents document-oriented editing or display surfaces.

`[SURFACE:frame]` Represents application frame/window chrome surfaces.

`[BEHAVIOR:async]` Uses async/await patterns for concurrent execution.

`[BEHAVIOR:panics-on-error]` Contains unwrap/expect/panic patterns that abort on failure.

`[BEHAVIOR:logs-and-continues]` Logs errors and continues without propagating or aborting.

`[BEHAVIOR:returns-nil-on-error]` Returns nil/null/None on error instead of propagating.

`[BEHAVIOR:swallows-errors]` Catches errors without re-raising or propagating them.

`[BEHAVIOR:propagates-errors]` Propagates errors to callers via Result, throw, or raise.

`[SURFACE:http-handler]` Implements HTTP request handling or web endpoint logic.

`[SURFACE:database]` Interacts with database services or ORMs.

`[SURFACE:external-api]` Makes outbound calls to external HTTP APIs or services.

`[SURFACE:template]` Uses template engines for rendering output.

`[QUALITY:undocumented]` Has public symbols without documentation.

`[QUALITY:complex-flow]` Contains functions with high cognitive complexity.

`[QUALITY:error-boundary]` Concentrated error handling — many panic, swallow, or propagation sites.

`[QUALITY:concurrency-heavy]` Uses multiple concurrency primitives (async, locks, spawn).

`[QUALITY:syntax-degraded]` Parse errors detected — semantic analysis may be incomplete.

## Layer 0 -- Config

`SEMMAP.md`
Generated semantic map.

`criticism.md`
Support file for criticism.

`north-star.md`
Support file for north-star.

`package.json`
Node.js package manifest.

`vite.config.js`
Implements vite.config functionality.
Exports: default

## Layer 1 -- Domain (Engine)

`package-lock.json`
Implements package-lock functionality. data.

`scripts/run-regression-fixtures.js`
Implements run-regression-fixtures functionality. [COUPLING:mixed] [BEHAVIOR:owns-const-state,persists,async]
Semantic: async side-effecting adapter

`src/App.jsx`
Implements App functionality. [COUPLING:mixed] [BEHAVIOR:owns-const-state,swallows-errors] [QUALITY:syntax-degraded]
Exports: App, default
Semantic: side-effecting constant-owning module that swallows errors

`src/components/CopywritingStep.jsx`
Implements copywriting step. [COUPLING:mixed] [BEHAVIOR:owns-state] [QUALITY:complex-flow,syntax-degraded]
Exports: CopywritingStep, default
Semantic: side-effecting stateful module

`src/components/DealtagStep.jsx`
Implements dealtag step. [COUPLING:pure] [QUALITY:syntax-degraded]
Exports: DealtagStep, default
Semantic: pure computation

`src/components/DedupeStep.jsx`
Implements dedupe step. [COUPLING:pure] [BEHAVIOR:async] [QUALITY:complex-flow,syntax-degraded]
Exports: DedupeStep, default
Semantic: async pure computation

`src/logic/copywriting.js`
Validates and merge. [HOTSPOT] [COUPLING:pure] [BEHAVIOR:owns-const-state] [QUALITY:undocumented]
Exports: appendDealToRawInput, cleanAndParsePatchJSON, parseRawToGroups, cleanAndParseJSON
Semantic: pure computation constant-owning module

`src/logic/dealtag.js`
Implements transform functionality. [HOTSPOT] [COUPLING:pure] [BEHAVIOR:owns-const-state] [QUALITY:complex-flow]
Exports: transform
Semantic: pure computation constant-owning module

`src/logic/dedupe.js`
Parses hq dates. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state] [QUALITY:undocumented,complex-flow]
Exports: ingestWebsiteJSON, runFullMatch, parseHQDates, dateFmt
Semantic: side-effecting stateful module

`src/logic/suppliers.js`
Implements supplier catalog. [HOTSPOT] [COUPLING:pure] [BEHAVIOR:owns-const-state] [QUALITY:undocumented]
Exports: isTagEligibleSupplier, familyOf, canonicalVendor, resolveVendor
Semantic: pure computation constant-owning module

`src/main.jsx`
Support file for the src subsystem. [QUALITY:syntax-degraded]

## Layer 3 -- App / Entrypoints

`index.html`
Deal Pipeline

`src/App.css`
Implements app functionality. styles.


## DependencyGraph

```yaml
DependencyGraph:
  # --- Entrypoints ---
  index.html:
    Imports: []
    ImportedBy: []
  # --- High Fan-In Hotspots ---
  copywriting.js:
    Imports: []
    ImportedBy: [App.jsx, CopywritingStep.jsx, run-regression-fixtures.js]
  dealtag.js:
    Imports: [suppliers.js]
    ImportedBy: [DealtagStep.jsx, run-regression-fixtures.js]
  dedupe.js:
    Imports: [suppliers.js]
    ImportedBy: [DedupeStep.jsx, run-regression-fixtures.js]
  suppliers.js:
    Imports: []
    ImportedBy: [dealtag.js, dedupe.js, run-regression-fixtures.js]
  # --- Layer 0 -- Config ---
  SEMMAP.md, criticism.md, north-star.md, package.json, vite.config.js:
    Imports: []
    ImportedBy: []
  # --- Layer 1 -- Domain (Engine) ---
  App.jsx:
    Imports: [CopywritingStep.jsx, DealtagStep.jsx, DedupeStep.jsx, copywriting.js]
    ImportedBy: [main.jsx]
  CopywritingStep.jsx:
    Imports: [copywriting.js]
    ImportedBy: [App.jsx]
  DealtagStep.jsx:
    Imports: [dealtag.js]
    ImportedBy: [App.jsx]
  DedupeStep.jsx:
    Imports: [dedupe.js]
    ImportedBy: [App.jsx]
  main.jsx:
    Imports: [App.css, App.jsx]
    ImportedBy: []
  package-lock.json:
    Imports: []
    ImportedBy: []
  run-regression-fixtures.js:
    Imports: [copywriting.js, dealtag.js, dedupe.js, suppliers.js]
    ImportedBy: []
  # --- Layer 3 -- App / Entrypoints ---
  App.css:
    Imports: []
    ImportedBy: [main.jsx]
```
