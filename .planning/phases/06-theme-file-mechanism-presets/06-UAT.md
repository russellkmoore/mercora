---
status: passed
phase: 06-theme-file-mechanism-presets
source: [06-VERIFICATION.md]
started: 2026-09-04T21:13:33Z
updated: 2026-09-04T21:19:43Z
---

## Current Test

number: 1
name: Concurrent-save race on getActiveTheme()
expected: |
  Two overlapping requests around an admin theme save each resolve to a valid manifest theme name (pre-save or post-save value), never mixed, empty, or throwing.
awaiting: none

## Tests

### 1. Concurrent-save race on getActiveTheme()
expected: Interleave two requests around an admin theme save; each renders a valid data-theme (old or new). PLAN-tagged backstop; only structural no-cache evidence exists.
result: accepted (user waived live check 2026-09-04; code-level evidence in 06-VERIFICATION.md)

### 2. Admin Appearance page browser walkthrough
expected: With a real Clerk admin session at /admin/settings/appearance: click a card (ring appears, Active badge does not move), Save (toast "Theme updated to {label}."), Active badge moves; arrow keys move selection, Space/Enter select. Storefront reflects the new theme on reload.
result: accepted (user waived live check 2026-09-04; code-level evidence in 06-VERIFICATION.md)

### 3. Dialog and AlertDialog scrim fix, live under luxe
expected: Under the luxe preset, a real checkout-confirmation Dialog and an admin AlertDialog show a dark bg-black/NN backdrop that recedes the content behind it (same as the already-verified Sheet overlay).
result: accepted (user waived live check 2026-09-04; code-level evidence in 06-VERIFICATION.md)

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
