---
status: testing
phase: 03-decision-lock-in-and-operator-runbooks
source: [03-VERIFICATION.md]
started: 2026-09-02T23:12:00Z
updated: 2026-09-02T23:12:00Z
---

## Current Test

number: 1
name: Confirm the `/gsd-ingest-docs` classifier reads all four ADR docs as locked
expected: |
  Running `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml --mode merge` on a throwaway branch classifies all four ADR docs (checkout-trust-boundary.md, webhooks-refunds-inventory.md, database-migrations.md, subscriptions.md) as locked, with no I17 lock-status note and no W1 warning that checkout-trust-boundary.md contradicts a SPEC or PRD source.
awaiting: user response

## Tests

### 1. Confirm the `/gsd-ingest-docs` classifier reads all four ADR docs as locked
expected: Running `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml --mode merge` on a throwaway branch classifies all four ADR docs as locked, with no I17 lock-status note and no W1 warning. Steps: `git switch -c tmp/ingest-check`, run the command, inspect `.planning/INGEST-CONFLICTS.md` and the four classification files under `.planning/intel/classifications/`, then `git switch main && git branch -D tmp/ingest-check` and discard any working-tree changes.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
