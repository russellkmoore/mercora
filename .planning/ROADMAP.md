# Roadmap: Mercora

## Milestones

- ✅ **v1 Hardening** — Phases 1-4 (shipped 2026-09-02) — [archive](milestones/v1-ROADMAP.md)
- ✅ **v2 Themeable Storefront** — Phases 5-8.2 (shipped 2026-09-05) — [archive](milestones/v2-ROADMAP.md)
- ✅ **v2.1 Gift Card Product** — Phases 9-12 (shipped 2026-09-10) — [archive](milestones/v2.1-ROADMAP.md)

## Phases

<details>
<summary>✅ v1 Hardening (Phases 1-4) — SHIPPED 2026-09-02</summary>

Hardening pass on the live Voltique storefront: dead published credential, fail-closed admin guard, telemetry for silent failure modes, ADRs locked, runbooks and reference docs brought in line with the code.

- [x] Phase 1: Security and Admin-Auth Truth (4/4 plans) — completed 2026-09-02
- [x] Phase 2: Observability and Regression Guards (5/5 plans) — completed 2026-09-02
- [x] Phase 3: Decision Lock-In and Operator Runbooks (3/3 plans) — completed 2026-09-02
- [x] Phase 4: Reference Documentation Refresh (5/5 plans) — completed 2026-09-02

Full phase details, success criteria, and plan lists: `milestones/v1-ROADMAP.md`. Requirements and backlog: `milestones/v1-REQUIREMENTS.md`. Audit: `milestones/v1-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v1-phases/`.

</details>

<details>
<summary>✅ v2 Themeable Storefront (Phases 5-8.2) — SHIPPED 2026-09-05</summary>

The storefront is skinnable without touching component code: a theme is one 23-token CSS file in `themes/`, validated at build time, chosen from admin with swatch previews, and applied per request to the storefront, transactional emails, and the crash page. Three page templates expose enumerated layout switches set from admin. Seven presets ship. Docs pruned to 20 files and rewritten product-neutral, with a root `AGENTS.md` for coding assistants.

- [x] Phase 5: Token Contract & Component Sweep (12/12 plans) — completed 2026-09-04
- [x] Phase 6: Theme File Mechanism & Presets (5/5 plans) — completed 2026-09-04
- [x] Phase 6.1: Remaining Presets: Clinical, Retro, Atelier, Market (4/4 plans, inserted) — completed 2026-09-04
- [x] Phase 7: Layout Switches (5/5 plans) — completed 2026-09-05
- [x] Phase 8: Documentation & Visual QA Close-out (5/5 plans) — completed 2026-09-05
- [x] Phase 8.1: v2 Tech-Debt Closure (7/7 plans, inserted) — completed 2026-09-05
- [x] Phase 8.2: Documentation Overhaul & Agent Onboarding (6/6 plans, inserted) — completed 2026-09-05

Full phase details, success criteria, and plan lists: `milestones/v2-ROADMAP.md`. Requirements: `milestones/v2-REQUIREMENTS.md`. Audit and accepted tech debt: `milestones/v2-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v2-phases/`.

</details>

<details>
<summary>✅ v2.1 Gift Card Product (Phases 9-12) — SHIPPED 2026-09-10</summary>

A shopper can buy a Voltique gift card on the storefront and the recipient receives it by email, on the gift-card backend that shipped in v1 (ADR-CTB-10). Catalogue product with four denominations and a Workers-AI image; product-page recipient form; recipient details through cart, checkout and order history; digital-only checkout with a billing step; key rings and flags live in production; Volt, article and Terms aligned to the code; one real production purchase proved issuance and delivery. Post-proof: gift-card tender on the payment step with Apply/Remove, masked code on the summary, Account → Gift cards removed.

- [x] Phase 9: Gift Card Catalogue (4/4 plans) — completed 2026-09-08
- [x] Phase 10: Gift Card Purchase Flow (5/5 plans) — completed 2026-09-09
- [x] Phase 11: Production Enablement (5/5 plans) — completed 2026-09-09
- [x] Phase 12: Content, Assistant & Live Proof (6/6 plans) — completed 2026-09-10

Full phase details, success criteria, and plan lists: `milestones/v2.1-ROADMAP.md`. Requirements: `milestones/v2.1-REQUIREMENTS.md`. Audit and accepted tech debt: `milestones/v2.1-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v2.1-phases/`.

</details>

## Next

No active milestone. Seeds for the next one live in `.planning/todos/pending/` (gift-card admin and sell/honor flags, blog navigation and home block, saved payment methods). Phase numbering continues at 13.
