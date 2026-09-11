# Roadmap: Mercora

## Milestones

- ✅ **v1 Hardening** — Phases 1-4 (shipped 2026-09-02) — [archive](milestones/v1-ROADMAP.md)
- ✅ **v2 Themeable Storefront** — Phases 5-8.2 (shipped 2026-09-05) — [archive](milestones/v2-ROADMAP.md)
- ✅ **v2.1 Gift Card Product** — Phases 9-12 (shipped 2026-09-10) — [archive](milestones/v2.1-ROADMAP.md)
- ✅ **v2.2 Operations & Polish** — Phases 13-19 (shipped 2026-09-11) — [archive](milestones/v2.2-ROADMAP.md)

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

<details>
<summary>✅ v2.2 Operations & Polish (Phases 13-19) — SHIPPED 2026-09-11</summary>

Gift cards became operable: sell and honor flags that mean what they say, an honor guard that never strands money, and a real admin panel with a full audit trail replacing the five-column read-only queue. The shopper-facing gaps the v2.1 live test exposed closed: an in-place address modal on subscription product pages, the blog reachable from the header and home page, saved payment methods replacing the dead Stripe Link box. Eight pieces of tech debt from v2.1 closed, including a silent order-confirmation-email skip on digital-only orders. Phase 19 — the deliberately-last, human-only checkpoint — closed Stripe Tax, the support-email routing gap, and a stale production secret, all confirmed live.

- [x] Phase 13: Gift-Card Flags (9/9 plans) — completed 2026-09-10
- [x] Phase 14: Gift-Card Admin & Audit Trail (9/9 plans) — completed 2026-09-10
- [x] Phase 15: Subscription Address In Place (3/3 plans) — completed 2026-09-11
- [x] Phase 16: Blog Surfacing (4/4 plans) — completed 2026-09-11
- [x] Phase 17: Saved Payment Methods (6/6 plans) — completed 2026-09-11
- [x] Phase 18: Tech-Debt Closure (7/7 plans) — completed 2026-09-11
- [x] Phase 19: Operator Checklist (1/1 plan, human-checkpoint) — completed 2026-09-11

Full phase details, success criteria, and plan lists: `milestones/v2.2-ROADMAP.md`. Requirements: `milestones/v2.2-REQUIREMENTS.md`. Phase artifacts: `milestones/v2.2-phases/`.

</details>

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1 Hardening | 1-4 | 17/17 | Complete | 2026-09-02 |
| v2 Themeable Storefront | 5-8.2 | 44/44 | Complete | 2026-09-05 |
| v2.1 Gift Card Product | 9-12 | 20/20 | Complete | 2026-09-10 |
| v2.2 Operations & Polish | 13-19 | 39/39 | Complete | 2026-09-11 |
