# Dependency Security Baseline

**Status:** No critical findings; two owned upstream package exceptions remain
**Baseline date:** 2026-08-11
**Owners:** Russell K. Moore and Devon Hillard
**Next review:** 2026-08-25

## Scope

This baseline separates the dependencies deployed with Mercora from packages
used only to build, lint, migrate, preview, or deploy it. Reproduce the checks
with:

```bash
npm audit
npm audit --omit=dev
```

The M01 branch-cut audit was captured from commit `45244fd` with Node 24.18.1,
npm 11.16.0, and the committed lockfile:

```bash
npm audit --omit=dev --json
```

It reported 0 critical, 3 high, 0 moderate, and 0 low production findings.
The three records are the direct `next` dependency and its bundled `postcss`
and optional `sharp` packages. npm offers only a semver-major update to Next
16.3.0 for this set, so M01 does not apply that breaking framework upgrade.
Every high-severity production path is traced to one of the two owned,
time-bounded exceptions below.

For historical context, the pre-remediation lockfile reported 62 findings: 2
low, 35 moderate, 21 high, and 4 critical. Its production-only view reported
55 findings: 2 low, 30 moderate, 19 high, and 4 critical.

The 2026-08-03 full-tree audit and fresh M01 production audit are:

| Scope | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full dependency tree (2026-08-03) | 0 | 4 | 7 | 0 | 11 |
| Production dependencies (2026-08-11) | 0 | 3 | 0 | 0 | 3 |

The three production records represent one direct package, `next`, and its two
bundled vulnerable packages. They are covered by the two exceptions below.

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

### Next-bundled PostCSS 8.4.31

- **Owners / review deadline:** Russell K. Moore and Devon Hillard; review by
  2026-08-25.
- **Advisories:** `GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`,
  `GHSA-fxqj-rqcc-2cmp`, and `GHSA-qx2v-qp2m-jg93`
- **Package path:** `next > postcss`
- **Why it remains:** Next 15.5.22 pins PostCSS 8.4.31. npm's supported fix is
  a breaking upgrade to Next 16.
- **Exposure:** PostCSS runs against repository-controlled CSS during the
  trusted build. Mercora does not accept customer CSS or compile CMS content as
  CSS, so an unauthenticated user cannot supply the malicious source-map input.
- **Compensating controls:** Builds run from reviewed repository content;
  dependencies are lockfile-pinned; Dependabot checks weekly; the separately
  installed project PostCSS is patched to 8.5.25.
- **Exit condition:** Upgrade to a supported Next 16 release that bundles a
  patched PostCSS, then raise the CI audit gate from `critical` to `high`.

### Next-bundled Sharp 0.34.5

- **Owners / review deadline:** Russell K. Moore and Devon Hillard; review by
  2026-08-25.
- **Advisory:** `GHSA-f88m-g3jw-g9cj`
- **Package path:** `next > sharp`
- **Why it remains:** Next 15.5.22 allows the 0.34 line. npm's supported fix is
  a breaking upgrade to Next 16.
- **Exposure:** Mercora configures a custom image loader instead of Next's
  server-side native image optimizer, so requests do not invoke Sharp on
  attacker-supplied image data in the deployed Cloudflare application.
- **Compensating controls:** The custom loader remains required; image handling
  must not be changed to the default optimizer while this exception is open;
  dependencies are lockfile-pinned and checked weekly.
- **Exit condition:** Upgrade to a supported Next 16 release that uses Sharp
  0.35 or newer, validate image behavior, then raise the CI audit gate.

## Development-only findings

The full-tree audit also reports findings below the deployed application
boundary, principally:

- `undici` through Wrangler/Miniflare, used for local preview and emulation
- Legacy `esbuild` through Drizzle Kit's migration CLI

These tools must only process trusted project input and must not expose their
development servers to untrusted networks. They remain under weekly Dependabot
review and should be re-evaluated with the Next 16/toolchain follow-up.

## Enforcement and follow-up

CI runs `npm audit --omit=dev --audit-level=critical`, preventing a return of
critical production findings while the two documented high-severity exceptions
remain. Do not weaken the gate or add new exceptions without recording the
package path, exposure, compensating controls, owner, review date, and exit
condition here.

The follow-up Next 16 pull request should include the ESLint CLI migration,
framework codemods, Cloudflare build validation, and removal of both production
exceptions. Once it lands, CI should enforce:

```bash
npm audit --omit=dev --audit-level=high
```
