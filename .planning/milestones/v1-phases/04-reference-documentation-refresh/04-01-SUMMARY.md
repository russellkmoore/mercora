---
phase: 04-reference-documentation-refresh
plan: 01
subsystem: docs
tags: [documentation, ai-model-config, mcp, mermaid]

requires: []
provides:
  - "docs/DEPLOYMENT_SETUP.md, docs/ai-pipeline.md, docs/ROADMAP.md all name the current text model @cf/openai/gpt-oss-20b"
  - "docs/ai-pipeline.md flowchart node id renamed LlamaModel -> TextModel across all 4 references"
  - "docs/ROADMAP.md states the correct MCP tool count (19, re-counted from app/api/mcp/route.ts)"
affects: [04-02, 04-03, 04-04]

actuals:
  tokens: 613
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Tracer-first sweep: prove the one-line correction pattern on Task 1 before expanding to the multi-site diagram rename in Task 2"
    - "Source-verify-before-write: re-read lib/ai/config.ts and re-count app/api/mcp/route.ts case arms in-session before writing any doc claim"

key-files:
  created: []
  modified:
    - docs/DEPLOYMENT_SETUP.md
    - docs/ai-pipeline.md
    - docs/ROADMAP.md

key-decisions:
  - "Used the bare backticked-id form (`@cf/openai/gpt-oss-20b`) rather than the readable-name-plus-id form on the dense DEPLOYMENT_SETUP.md and ROADMAP.md stack/feature lines, per D-01's explicit exception for dense lines"
  - "Renamed the ai-pipeline.md mermaid node id LlamaModel -> TextModel, updating the node definition, both edge statements, and the class statement in one commit so no reference is orphaned"

patterns-established:
  - "Mermaid node-id rename gate: pre-edit reference count must equal post-edit new-id count, verified by grep -c before writing the ADR/pattern doc"

requirements-completed: [REF-01]

coverage:
  - id: D1
    description: "docs/DEPLOYMENT_SETUP.md AI Platform bullet names @cf/openai/gpt-oss-20b, no superseded model name survives"
    requirement: "REF-01"
    verification:
      - kind: other
        ref: "grep -c 'gpt-oss-20b' docs/DEPLOYMENT_SETUP.md == 1; grep -ic 'llama' docs/DEPLOYMENT_SETUP.md == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/ai-pipeline.md sequence-diagram message and flowchart node label name the current model; mermaid node id renamed LlamaModel -> TextModel at all 4 reference sites with zero orphans"
    requirement: "REF-01"
    verification:
      - kind: other
        ref: "grep -c 'TextModel' docs/ai-pipeline.md == 4; grep -ic 'llama' docs/ai-pipeline.md == 0; grep -c 'gpt-oss-20b' docs/ai-pipeline.md == 2; class statement and quoted-emoji label both verified"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/ROADMAP.md analytics bullet names the current model and MCP server bullet states 19 tools, re-counted from app/api/mcp/route.ts"
    requirement: "REF-01"
    verification:
      - kind: other
        ref: "grep -c 'case ''' app/api/mcp/route.ts == 19; grep -c 'with 19 tools' docs/ROADMAP.md == 1; grep -cE 'with 1[0-8] tools' docs/ROADMAP.md == 0; diff is exactly 2 added lines"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-03
status: complete
---

# Phase 4 Plan 1: Model Name and MCP Tool Count Sweep Summary

Corrected the stale "Llama 3.1 8B" model reference and the stale "17 tools" MCP count across `docs/DEPLOYMENT_SETUP.md`, `docs/ai-pipeline.md`, and `docs/ROADMAP.md`, including a full mermaid node-id rename (`LlamaModel` → `TextModel`) in the AI pipeline diagrams.

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-02T~24:29:00Z (session start)
- **Completed:** 2026-09-03T00:41:39Z
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- `docs/DEPLOYMENT_SETUP.md:14` AI Platform bullet now names `@cf/openai/gpt-oss-20b` instead of the superseded model family
- `docs/ai-pipeline.md` sequence-diagram message and flowchart node label both name `@cf/openai/gpt-oss-20b`; mermaid node id renamed `LlamaModel` → `TextModel` at all 4 reference sites (node definition, two edges, class statement) with zero orphaned references
- `docs/ROADMAP.md` analytics bullet names the current model, and the MCP server bullet states the correct tool count (19, re-counted live from `app/api/mcp/route.ts`'s 19 `case '...':` dispatch arms, matching the 19-name "Available tools" error string)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end model-name correction on one line** - `07d092b` (docs)
2. **Task 2: AI pipeline diagrams — model label plus full mermaid node-id rename** - `c78f48a` (docs)
3. **Task 3: Roadmap analytics line and MCP tool count** - `f9ff3eb` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `docs/DEPLOYMENT_SETUP.md` - AI Platform stack bullet now names the current text model id
- `docs/ai-pipeline.md` - Sequence-diagram message, flowchart node label, and mermaid node id (`LlamaModel` → `TextModel`, all 4 references) now name the current model
- `docs/ROADMAP.md` - Analytics feature bullet names the current model; MCP Server Implementation bullet states 19 tools (was 17)

## Reference counts (for plan 04-02, which must agree)

- **Mermaid node id rename (`docs/ai-pipeline.md`):** pre-edit `LlamaModel` references = 4 (node definition line 170, edges lines 200/201, class statement line 235). Post-edit `TextModel` references = 4. Post-edit `LlamaModel` references = 0.
- **MCP tool-arm count (`app/api/mcp/route.ts`):** re-counted this session via `/usr/bin/grep -c "case '" app/api/mcp/route.ts` = **19**. The "Available tools" error string at line 193 enumerates the same 19 names in the same order. Plan 04-02 writes this same figure (19) into `docs/CLAUDE.md` and must agree.

## Decisions Made
- Used the bare backticked-id form on dense stack/feature lines (`DEPLOYMENT_SETUP.md`'s AI Platform bullet, `ROADMAP.md`'s two bullets), per D-01's explicit allowance, rather than the longer "gpt-oss-20b (`@cf/openai/gpt-oss-20b`)" form — keeps the existing sentence density unchanged (D-04 scope discipline).
- Renamed the mermaid node id to `TextModel` (an example name suggested in CONTEXT.md's decision) since no other constraint favored a different id.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
Ready for plans 04-02, 04-03, 04-04 (own disjoint file sets within this phase) and the phase-level repo-wide `docs/` sweep gate once all four plans land. `docs/CLAUDE.md` is owned by plan 04-02 and must state the same 19-tool count verified here.

---
*Phase: 04-reference-documentation-refresh*
*Completed: 2026-09-03*

## Self-Check: PASSED

All three modified files and all three task commits (07d092b, c78f48a, f9ff3eb) verified present on disk / in git log.
