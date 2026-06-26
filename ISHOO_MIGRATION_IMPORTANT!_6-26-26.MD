# ⚠️ IMPORTANT — Ishoo Store Migration (2026-06-26)

Ishoo was updated so that future updates can **never brick your stores** by adding new
fields (the FIX-120 class). This note explains the one action to take.

## TL;DR
- **Nothing has changed on disk yet. Nothing can break right now.** Installing the new
  Ishoo binary keeps reading and writing your stores exactly as before.
- When you're ready, **upgrade Ishoo on ALL your machines first**, then run ONCE:

      ishoo migrate-stores --all --yes

  (Run `ishoo migrate-stores --all` *without* `--yes` first to preview — it changes nothing.)

## What this does
- The new binary can **read both** the old store format and the new additive-safe format,
  so it can never fail to read your existing stores.
- `migrate-stores` converts your stores to the new format so new Ishoo fields can be added
  forever without checksum / "tampered or corrupt" / brick errors.

## The ONE rule
Converting is a **one-way flip**. Once a store is migrated, an **older** Ishoo binary will
refuse to read it ("uses format version 3"). So:

1. Update Ishoo on **every** machine that shares these stores (your 2–3 machines).
2. THEN run `ishoo migrate-stores --all --yes` on one machine.

Since you always upgrade everything to latest, this is safe — just don't run an *old*
Ishoo binary against a store after you've migrated it.

## If something looks wrong
- A migrated store read by an old binary fails **loudly** ("Upgrade Ishoo"), it does **not**
  silently corrupt. Upgrade that machine and it works again.
- Stores are versioned on the `refs/ishoo/store` git ref, so history is recoverable.

— Generated 2026-06-26
