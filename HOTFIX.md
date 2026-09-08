# Operator workflow hotfix — September 8, 2026

The weekly workflow now focuses on reviewing candidate matches and carrying only
new offers and intentional changes into copy preparation.

## Interface

- A consistent light workspace with restrained teal actions, readable offer text,
  compact source panes, and responsive layouts across Tag, Compare, and Publish.
- Tagging keeps long email and output lists inside their panes. Editing input
  invalidates the old tagged output so it cannot be handed forward accidentally.
- Compare imports the website JSON and starts new sessions at score zero.
  Candidate matches appear weakest first with incoming and website copy side by
  side, explicit date differences, and optional scoring explanations.
- Each candidate can be unchanged, an update, or a different/new deal. Unchanged
  offers stay out of the action list. The operator can confirm all remaining
  candidates unchanged after scanning the list. Single and bulk decisions support
  undo; saved decisions survive navigation and reload.
- New and changed offers proceed together once match review is finished. Updates
  retain the existing website title through the publishing handoff and suppress a
  replacement URL slug in the UI.
- Publish includes pending, attention, done, and all filters; supplier/offer
  search; explicit field-copy buttons; and explicit completion. Copying a
  description no longer implies that an offer has been published.
- Lint adds missing-copy, impossible-date, and reversed-date checks. Existing
  material-claim checks remain intact. Clean paraphrases stay quiet.

## Verification

- `npm test`: Rust core tests, existing regression fixtures (including the
  89-deal weekly email), and operator routing/lint tests passed.
- `npm run build`: TypeScript and production Astro build passed.
- Local browser: tagged a three-supplier input, imported a website fixture,
  reviewed a date update and an unchanged match, confirmed the unchanged match
  was omitted from the copy handoff, validated clean AI copy, checked copy-button
  feedback, and verified explicit completion removes a row from the pending view.

Work was integrated in the original checkout on main, with no additional
worktrees. Existing unrelated configuration and mapping edits were preserved.
No website deals were published and no remote push was performed.
