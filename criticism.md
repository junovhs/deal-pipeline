I reviewed the exported project and the current pipeline end to end. The good news is that the foundation is already solid: you have one shared supplier source of truth, vendor-family normalization, an explainable matcher with reason chips, and a copy step with gating, quick-add, and patch flows. The bad news is that the weekly friction is coming from two specific design choices: the matcher relies on one composite score plus one threshold, and the copy “linter” relies on token novelty rather than factual slot validation. Those two things are what I would attack first.

## What I would fix first

1. **Fix the line-format inconsistency immediately.**
   Dedupe’s `parseHQ` only accepts `v/d/ed` lines when they are tab-delimited, but the Dedupe textarea placeholder shows space-delimited examples, and Copy’s parser plus Quick Add both generate/accept space-delimited lines. That means manual edits can silently fail before matching even starts. This is a real reliability bug, not just a polish issue. Make all three steps accept both spaces and tabs, then normalize internally to one format.

2. **Replace the single-threshold matcher with a 3-way decision.**
   Right now Dedupe scores pairs, then treats anything below the global threshold (default `8`) as unmatched, while higher scores become matched or “extension.” The UI already hints that scores under `15` are weak, but the system still uses one low threshold for the actual decision. That is where false positives and false negatives come from. You want:
   - auto-match only above a **high-confidence** threshold,
   - auto-unmatch below a **low-confidence** threshold,
   - human review in the middle.
     For your workflow, that middle band will save you more time than trying to “perfect” one magic number.

3. **Redesign the linter around facts, not words.**
   The current validator extracts words from source and AI output, then warns on words not in source unless they are in a hand-maintained allowlist. That is exactly why harmless paraphrases like “included,” “this,” or “featuring” become noisy warnings, while some real factual drifts can still slip through if the word happens to be allowlisted. Keep the linter, but make it compare structured facts instead of raw vocabulary.

## The matcher: how to make it materially better

Your current matcher groups HQ and website deals by vendor family, extracts a feature bag plus dollars/percents, scores overlap/mismatch/date/text similarity, and then solves the assignment with Hungarian or greedy matching. That is a decent baseline, and it is not the part I would throw away. I would make it more selective before scoring and more strict after scoring.

### What to add

**A. Add structured fields, not just feature tags.**
Today you extract features like `obc`, `ppg`, `covert`, `airfare`, `deposit`, plus raw dollar and percent lists. That is helpful, but it is still too coarse for deal matching. Add explicit slots for:

- benefit type: OBC / gratuities / deposit / dining / free night / airfare / resort credit / spa credit / kids free / amenity
- amount and unit: `$150`, `30%`, `for 2`, `per couple`
- scope qualifiers: `select sailings`, `eligible domestic`, `Caribbean`, `West Coast Shorts & Mexico`
- audience: `kids 3 to 9`, `3rd/4th guests`
- deal family: hidden fare / no perk / instant savings / group fare / anniversary / babymoon
- geography or product scope: `Treasure Beach`, `Maldives`, `Disneyland Resort Hotel`
  You will get a much better matcher from richer extraction than from endlessly tweaking weights. The current feature patterns are a good start, but they are missing a lot of the concepts that appear in your weekly output.

**B. Add hard blockers.**
Some mismatches should not merely reduce score; they should block auto-match:

- same benefit class but materially different amount
- different audience/guest count
- different geography/destination class
- hidden-fare vs public-rate mismatch
- exact supplier mismatch within the same family unless explicitly allowed
  Right now the scorer penalizes conflicts, but many are still “soft.” For automation, some conflicts need to be “no auto-match.”

**C. Add exact-supplier bonus and family-cross penalty.**
You already normalize by vendor family, which is useful for grouped brands like Viking and Scenic. But inside a family, there should still be a meaningful preference for exact supplier alignment. Otherwise you can get family-level false positives that look numerically plausible.

**D. Show top 3 candidates, not just the chosen one.**
The current UI shows the selected match or unmatched outcome, with reason chips, but not alternate candidates. For review-band deals, the user should see the top 3 candidates with score deltas and one-click actions: Match, Extension, Reject, Keep Unmatched. That will make debugging and trust dramatically better.

**E. Learn from your own corrections.**
Right now rejects are manual and session-level. Start logging:

- source deal text
- chosen website deal
- score features
- your final action: matched / extension / rejected / unmatched
- optional reason
  After 4–8 weeks, you will have enough real data to tune thresholds and rules from your actual vendors rather than intuition. That dataset is more valuable than a database choice. The app is currently localStorage/file-driven, so even a flat JSON log would be enough to start.

## The copy stage: how to make the final text cleaner

The prompt is already trying to be conservative: no invented facts, no codes, preserve qualifiers, hide covert/opaque language, and force `EXCLUSIVE:` for exclusive deals. It also has term replacements for `PPG`, `OBC`, and `PP`. That is good. But your recent output shows the system is still leaking internal jargon and over-warning on benign language.

### What to change

**A. Split warnings into three severities.**
Right now the gate is noisy because all “added word” findings feel similar. Split them like this:

- **Blocker**
  - invented amount, date, percentage, guest count, destination, audience, or condition
  - leaked promo/rate code
  - missing `EXCLUSIVE:` on exclusive
  - AI guessed a suspicious date

- **Review**
  - added benefit noun or scope that might change meaning
  - internal jargon not rewritten

- **Info**
  - stylistic filler like “this,” “featuring,” “explore”

Then show only Blocker + Review by default. Hide Info behind a “show low-signal warnings” toggle. That alone will make the page feel much quieter without making it less safe.

**B. Move from “word diff” to “slot diff.”**
For each raw deal, extract slots such as:

- exclusive?
- benefit type
- amount
- quantity (`for 2`)
- audience
- geography
- sale name
- urgency / hidden-price / call-agent requirement
  Then validate whether the headline/description preserve those slots.

That would correctly treat:

- `EXCLUSIVE PPGs for 2` → `EXCLUSIVE: Get Free Gratuities for 2` as **clean**
- `No Perk Rates` → `Explore No Perk Rates on Select Cruises` as **review/blocker** if “select cruises” was not in source

That is the change that will cut most false-positive lint noise while still catching real embellishment.

**C. Improve the house style for internal jargon.**
Your current house style explicitly handles PPG/OBC/PP and covert pricing, but it does not explicitly tell the model how to handle internal labels like `TLN`, `TLN Amenity`, `OCAPP`, `LTO`, `GTY`, `PBP`, `PHY`, or `P2P`. That is why some outputs still feel internal instead of customer-facing. Add a new rule: _never surface internal program names or internal shorthand unless the customer-facing benefit is genuinely unknown; if the benefit is unclear, use conservative copy and route to agent._

**D. Stop auto-appending CTA copy as a hidden post-process.**
`buildFinalDescription` currently appends either `Ends M/D.` if the end date is within 30 days, or `Call to speak with an agent!` otherwise. That means your final description is partly AI-written and partly runtime-generated. It also means the same base description can change behavior depending on when validation happens. I would either:

- move that rule into explicit UI controls, or
- store the suffix decision as data, not recompute it implicitly.

## Streamlining the workflow

The app is a pure client-side React/Vite tool with state spread across localStorage keys, file upload for website JSON, and no backend persistence. That is fine for a solo weekly workflow, but it means a lot of important decisions are not becoming reusable knowledge yet.

What I would do is keep the UI simple but unify the internal data model. Instead of shuttling plain tagged text between steps, define one canonical `DealRecord` through the whole pipeline:

- raw source
- canonical vendor
- parsed structured facts
- dedupe candidates + selected outcome
- copy result + warnings
- approved / rejected / patched state
- notes

That change will make Quick Add, patching, review queues, and export much less brittle. Right now the text format is doing too much of the work.

## Reliability: what is missing technically

The package only defines `dev`, `build`, and `preview`. There are no test scripts, no lint scripts, and no type-check step. So every matching or validator change is currently flying without a safety net. That is fine for a prototype, but it is the main reason the tool feels fragile as soon as it becomes important.

The highest-value investment here is not fancy infra. It is a fixture-based test harness:

- 8–12 historical weekly HQ inputs
- corresponding website JSON
- expected match outcomes
- expected copy warnings
- examples of correct patches

Then add tests for:

- vendor tagging
- date parsing
- candidate generation
- score/block rules
- lint severity behavior
- delimiter tolerance

That will let you improve aggressively without re-breaking last month’s edge cases.

## Postgres: worth it or not?

Not first.

A database will **not** make matching smarter by itself, and it will **not** make the linter less noisy by itself. Your current issues are algorithm and validation issues, not storage issues. Since the tool is still entirely client-side with localStorage and manual JSON ingest, I would first spend effort on parser consistency, structured extraction, candidate review bands, and tests.

Where Postgres _would_ help later is:

- storing weekly history
- saving labeled decisions and overrides
- tracking vendor-specific rules
- audit trail for why something matched
- multi-user use
- analytics on warning precision and match quality

For a single-user workflow, I would start with either a versioned JSON/NDJSON log or SQLite. Move to Postgres only when the history and labeling become core.

## The order I’d do this in

**First pass, highest ROI**

1. Accept spaces or tabs everywhere.
2. Add low/high thresholds plus a review band.
3. Add top-3 candidate display.
4. Change the linter to severity tiers and hide low-signal warnings.

**Second pass** 5. Add structured extraction for benefit type, amount, geography, audience, and scope. 6. Add hard blockers and exact-supplier bonus. 7. Expand house-style rules for internal jargon.

**Third pass** 8. Build fixture tests from recent weeks. 9. Log your accept/reject decisions. 10. Add historical storage only after the above is paying off.

My strongest advice is this: **do not reach for Postgres first; turn the matcher into a candidate-review system and turn the linter into a fact-checker.** That is where your weekly time savings will come from.
