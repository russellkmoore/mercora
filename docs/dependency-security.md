# Dependency Security Baseline

**Status:** No critical or high production findings; no open production exceptions
**Re-run date:** 2026-09-02
**Node:** 24.18.1
**npm:** 11.16.0
**Installed Next:** 16.3.1
**Installed PostCSS:** 8.5.26
**Production audit totals:** 0 critical, 0 high, 0 moderate, 0 low, 0 total
**Baseline date:** 2026-08-11
**Owners:** Russell K. Moore and Devon Hillard
**Next review:** 2026-12-01

## Scope

This baseline separates the dependencies deployed with Mercora from packages
used only to build, lint, migrate, preview, or deploy it. Reproduce the checks
with:

```bash
npm audit
npm audit --omit=dev
```

The 2026-09-02 re-run was captured with Node 24.18.1, npm 11.16.0, and the
committed lockfile, against installed `next@16.3.1`:

```bash
npm audit --omit=dev --audit-level=high
```

It reported 0 vulnerabilities at every severity in the production dependency
tree. Both former production exceptions (PostCSS and Sharp, bundled through
`next`) are closed below with the version evidence their exit conditions
required.

For historical context, the pre-remediation lockfile reported 62 findings: 2
low, 35 moderate, 21 high, and 4 critical. Its production-only view reported
55 findings: 2 low, 30 moderate, 19 high, and 4 critical.

The audit history to date:

| Scope | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full dependency tree (2026-08-03) | 0 | 4 | 7 | 0 | 11 |
| Production dependencies (2026-08-11, Next 15.5.22) | 0 | 3 | 0 | 0 | 3 |
| Production dependencies (2026-09-02, Next 16.3.1) | 0 | 0 | 0 | 0 | 0 |

## Remediated direct dependencies

| Dependency | Previous | Patched | Primary risk removed |
| --- | --- | --- | --- |
| `@clerk/nextjs` | `6.31.6` | `6.39.6` | Critical middleware route-protection bypass and authorization bypass |
| `next` | `15.3.5` | `15.5.22` | Critical React Flight RCE plus later request, cache, middleware, SSRF, and denial-of-service advisories |
| `@opennextjs/cloudflare` | `1.6.5` | `1.20.2` | CDN path-normalization SSRF |
| `drizzle-orm` | `0.35.3` | `0.45.2` | SQL injection through improperly escaped identifiers |
| `wrangler` | `4.40.2` | `4.118.0` | Pages-deploy command injection and patched toolchain dependencies |
| `postcss` | `8.5.6` | `8.5.25` | Source-map path traversal and file disclosure in the project build toolchain |

`@cloudflare/workers-types` and `@opennextjs/cloudflare` now live in
`devDependencies`, matching their type-generation, build, preview, and deploy
roles. Safe transitive updates were applied with `npm audit fix`; no forced
updates or audit suppressions were used.

## Time-bounded production exceptions

No production exception is open as of the 2026-09-02 re-run. Both prior
entries closed when Next 16.3.1 was installed; see below.

## Closed exceptions

### Next-bundled PostCSS 8.4.31

- **Owners:** Russell K. Moore and Devon Hillard.
- **Advisories:** `GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`,
  `GHSA-fxqj-rqcc-2cmp`, and `GHSA-qx2v-qp2m-jg93`
- **Package path:** `next > postcss`
- **Why it remained:** Next 15.5.22 pinned PostCSS 8.4.31. npm's supported fix
  was a breaking upgrade to Next 16.
- **Exposure:** PostCSS runs against repository-controlled CSS during the
  trusted build. Mercora does not accept customer CSS or compile CMS content
  as CSS, so an unauthenticated user could not supply the malicious
  source-map input.
- **Compensating controls (while open):** Builds ran from reviewed repository
  content; dependencies were lockfile-pinned; Dependabot checked weekly; the
  separately installed project PostCSS was patched to 8.5.25.
- **Closed:** exit condition met 2026-09-02. Installed Next is now `16.3.1`,
  which bundles `postcss@8.5.23` at `node_modules/next/node_modules/postcss`
  (observed via `npm ls postcss`) — no longer the flagged 8.4.31 line. The CI
  audit gate was raised from `critical` to `high` in this same phase
  (`.github/workflows/ci.yml`), and the production audit reports 0 findings
  at every severity.

### Next-bundled Sharp 0.34.5

- **Owners:** Russell K. Moore and Devon Hillard.
- **Advisory:** `GHSA-f88m-g3jw-g9cj`
- **Package path:** `next > sharp`
- **Why it remained:** Next 15.5.22 allowed the 0.34 line. npm's supported fix
  was a breaking upgrade to Next 16.
- **Exposure:** Mercora configures a custom image loader instead of Next's
  server-side native image optimizer, so requests did not invoke Sharp on
  attacker-supplied image data in the deployed Cloudflare application.
- **Compensating controls (while open):** The custom loader remained
  required; image handling was not changed to the default optimizer while
  this exception was open; dependencies were lockfile-pinned and checked
  weekly.
- **Closed:** exit condition met 2026-09-02. Installed Next is now `16.3.1`,
  which declares `sharp` as a direct dependency resolving to `0.35.3`. This
  version is hoisted to the top-level `node_modules/sharp` rather than nested
  under `node_modules/next/node_modules` — confirmed by
  `require.resolve('sharp')`, which returns
  `node_modules/sharp/dist/index.cjs`. The resolved version satisfies the
  exit condition's "Sharp 0.35 or newer" requirement, and the production
  audit reports 0 findings at every severity.

## Development-only findings

The 2026-09-02 full-tree `npm audit` reports 5 moderate findings, all below
the deployed application boundary:

- `esbuild` (`<=0.24.2`, moderate) — enables any website to send requests to
  the local development server and read the response. Path:
  `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild@0.18.20`.
- `@esbuild-kit/core-utils` (moderate, via the `esbuild` finding above) —
  path: `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils`.
- `@esbuild-kit/esm-loader` (moderate, via `@esbuild-kit/core-utils`) — path:
  `drizzle-kit > @esbuild-kit/esm-loader`.
- `drizzle-kit` (moderate, via `@esbuild-kit/esm-loader`) — path:
  `drizzle-kit@0.31.10` (devDependency; Drizzle Kit's migration CLI).
- `qs` (moderate) — array-limit bypass via bracket-key comma parsing, and a
  denial-of-service via attacker-controlled `isBuffer`. Path:
  `@opennextjs/cloudflare > @opennextjs/aws > express > qs@6.15.3` (also via
  `body-parser`). `@opennextjs/cloudflare` is a devDependency (build/deploy
  tooling).

Command that produced this list: `npm audit --json` (full tree, including
dev dependencies), re-run in this session.

These tools must only process trusted project input and must not expose their
development servers to untrusted networks. They remain under weekly Dependabot
review.

## Enforcement and follow-up

CI runs `npm audit --omit=dev --audit-level=high`, blocking on any high or
critical finding in the production dependency tree. Do not weaken the gate or
add new exceptions without recording the package path, exposure, compensating
controls, owner, review date, and exit condition here.

```bash
npm audit --omit=dev --audit-level=high
```
