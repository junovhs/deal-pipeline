# deal-core fixtures

Fixtures are grouped by the core behavior they lock down:

- `parser/` — raw input and expected parse records
- `suppliers/` — supplier-resolution cases
- `dedupe/` — website comparison and match cases
- `lint/` — copy diagnostics and severity cases
- `weekly/` — dated, representative weekly inputs used as historical regression checks

`run_fixture_suite` embeds the dated weekly smoke fixture so `cargo test` is deterministic and does not depend on a caller's working directory.
