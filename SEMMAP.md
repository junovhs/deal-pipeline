# project -- Semantic Map

**Purpose:** A bespoke pipeline that takes a simple list of deals from a weekly Dream Vacations promo email, and takes them all the way to published deals with full copy.

## Legend

`[ENTRY]` Application entry point

`[CORE]` Core business logic

`[TYPE]` Data structures and types

`[UTIL]` Utility functions

## Layer 0 -- Config

`package-lock.json`
Configuration for package-lock. Centralizes project configuration.

`package.json`
Node.js package manifest. Centralizes project configuration.

`vite.config.js`
Implements vite.config functionality. Centralizes project configuration.

## Layer 2 -- Domain

`src/logic/copywriting.js`
Implements copywriting functionality. Supports application functionality.

`src/logic/dealtag.js`
Implements dealtag functionality. Supports application functionality.

`src/logic/dedupe.js`
Implements dedupe functionality. Supports application functionality.

`src/logic/suppliers.js`
Implements suppliers functionality. Supports application functionality.

