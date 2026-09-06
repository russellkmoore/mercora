#!/usr/bin/env node
/**
 * Zero-dependency documentation gate for the docs/ tree, README.md,
 * CONTRIBUTING.md and SECURITY.md.
 *
 * This is Phase 8.2's documentation gate (DOCS-04). `npm run docs:lint` must
 * exit 0 against the tree these plans leave behind. See
 * .planning/phases/08.2-documentation-overhaul-agent-onboarding/08.2-02-PLAN.md
 * task 3 for the seven checks this script implements: dead-path references,
 * relative-link resolution, bidirectional manifest reconciliation, the
 * locked-ADR guard, npm script existence, credential-shaped strings, and the
 * docs header convention. It is a local gate — not wired into CI in this
 * phase (recorded as a follow-up).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const TAG = "docs-lint";
const REPO_ROOT = process.cwd();

const DOCS_DIR = "docs";
const CHANGELOG_PATH = "docs/CHANGELOG-docs.md";
const MANIFEST_PATH = "gsd-ingest-manifest.yaml";
const ROOT_SCAN_FILES = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];

// Locked ADRs (D-10 / gsd-ingest-manifest.yaml) — never merged, renamed or moved.
const LOCKED_ADRS = [
  "docs/checkout-trust-boundary.md",
  "docs/webhooks-refunds-inventory.md",
  "docs/database-migrations.md",
  "docs/subscriptions.md",
];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

/** Recursively collects markdown file paths (relative, posix) under `root`. */
function walkMarkdown(root, out) {
  const abs = path.join(REPO_ROOT, root);
  if (!existsSync(abs)) return;
  const stat = statSync(abs);
  if (stat.isFile()) {
    if (path.extname(root) === ".md") out.push(root);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = toPosix(path.join(root, entry.name));
    if (entry.isDirectory()) walkMarkdown(rel, out);
    else if (entry.isFile() && path.extname(entry.name) === ".md") out.push(rel);
  }
}

function docsMarkdownFiles() {
  const out = [];
  walkMarkdown(DOCS_DIR, out);
  return out.sort();
}

/** Markdown files directly under docs/ (the header-convention scope). */
function docsTopLevelMarkdownFiles() {
  const abs = path.join(REPO_ROOT, DOCS_DIR);
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile() && path.extname(e.name) === ".md")
    .map((e) => toPosix(path.join(DOCS_DIR, e.name)))
    .sort();
}

/**
 * The scan surface: every markdown file under docs/ plus the root README,
 * the contributing guide and the security policy. The changelog is excluded
 * for the dead-reference and relative-link checks (naming retired files is
 * its entire job) but included everywhere else.
 */
function scanSurface({ excludeChangelog }) {
  const files = [
    ...ROOT_SCAN_FILES.filter((f) => existsSync(path.join(REPO_ROOT, f))),
    ...docsMarkdownFiles(),
  ];
  return excludeChangelog ? files.filter((f) => f !== CHANGELOG_PATH) : files;
}

function readLines(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8").split("\n");
}

function violation(check, file, line, detail) {
  return { check, file, line, detail };
}

// --- Check 1: documentation references resolve -----------------------------
const DOCS_PATH_RE = /docs\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md/g;

function checkReferencesResolve() {
  const violations = [];
  const files = [...scanSurface({ excludeChangelog: true }), MANIFEST_PATH];
  for (const rel of files) {
    const lines = readLines(rel);
    lines.forEach((line, idx) => {
      DOCS_PATH_RE.lastIndex = 0;
      let m;
      while ((m = DOCS_PATH_RE.exec(line)) !== null) {
        const target = m[0];
        if (!existsSync(path.join(REPO_ROOT, target))) {
          violations.push(violation("references-resolve", rel, idx + 1, `references missing file ${target}`));
        }
      }
    });
  }
  return violations;
}

// --- Check 2: relative markdown links resolve -------------------------------
const MD_LINK_RE = /\]\(([^)]+)\)/g;

function isExternalOrAnchor(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#");
}

function checkRelativeLinksResolve() {
  const violations = [];
  const files = scanSurface({ excludeChangelog: true });
  for (const rel of files) {
    const lines = readLines(rel);
    const dir = path.dirname(rel);
    lines.forEach((line, idx) => {
      MD_LINK_RE.lastIndex = 0;
      let m;
      while ((m = MD_LINK_RE.exec(line)) !== null) {
        let target = m[1].trim();
        if (isExternalOrAnchor(target)) continue;
        target = target.split("#")[0];
        if (!target.endsWith(".md")) continue;
        const resolved = toPosix(path.normalize(path.join(dir, target)));
        if (!existsSync(path.join(REPO_ROOT, resolved))) {
          violations.push(violation("relative-links-resolve", rel, idx + 1, `broken link target ${target}`));
        }
      }
    });
  }
  return violations;
}

// --- Check 3: manifest reconciliation, both directions ----------------------
function parseManifestPaths() {
  const lines = readLines(MANIFEST_PATH);
  const entries = [];
  lines.forEach((line, idx) => {
    const m = /^\s*-\s*path:\s*(docs\/[A-Za-z0-9_.-]+\.md)\s*$/.exec(line);
    if (m) entries.push({ path: m[1], line: idx + 1 });
  });
  return entries;
}

function checkManifestReconciliation() {
  const violations = [];
  const manifestEntries = parseManifestPaths();
  for (const { path: p, line } of manifestEntries) {
    if (!existsSync(path.join(REPO_ROOT, p))) {
      violations.push(violation("manifest-reconciliation", MANIFEST_PATH, line, `manifest entry dangles: ${p}`));
    }
  }
  const docsFiles = docsTopLevelMarkdownFiles();
  const manifestSet = new Set(manifestEntries.map((e) => e.path));
  for (const f of docsFiles) {
    if (!manifestSet.has(f)) {
      violations.push(violation("manifest-reconciliation", f, 1, "unregistered in gsd-ingest-manifest.yaml"));
    }
  }
  if (manifestEntries.length !== docsFiles.length) {
    violations.push(
      violation(
        "manifest-reconciliation",
        MANIFEST_PATH,
        0,
        `count mismatch: manifest has ${manifestEntries.length} docs/ entries, tree has ${docsFiles.length} files`,
      ),
    );
  }
  return violations;
}

// --- Check 4: locked ADR guard -----------------------------------------------
function checkLockedAdrGuard() {
  const violations = [];
  const manifestLines = readLines(MANIFEST_PATH);
  for (const p of LOCKED_ADRS) {
    if (!existsSync(path.join(REPO_ROOT, p))) {
      violations.push(violation("locked-adr-guard", p, 0, "locked ADR missing from the working tree"));
    }
    if (!manifestLines.some((l) => l.includes(`path: ${p}`))) {
      violations.push(violation("locked-adr-guard", MANIFEST_PATH, 0, `locked ADR not listed in manifest: ${p}`));
    }
  }
  // Bind `locked: true` to each ADR's own entry: the marker must appear inside the
  // lines between `- path: <adr>` and the next `- path:`. A global count would still
  // pass if the marker moved to a different document.
  const stripped = manifestLines.filter((l) => !/^\s*#/.test(l));
  const entryStarts = stripped
    .map((l, i) => (/^\s*-\s*path:\s/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  for (const p of LOCKED_ADRS) {
    const start = stripped.findIndex((l) => l.includes(`path: ${p}`));
    if (start < 0) continue; // already reported above
    const next = entryStarts.find((i) => i > start) ?? stripped.length;
    const block = stripped.slice(start, next);
    if (!block.some((l) => /^\s*locked:\s*true\s*$/.test(l))) {
      violations.push(violation("locked-adr-guard", MANIFEST_PATH, 0, `locked ADR entry lacks locked: true: ${p}`));
    }
  }
  const lockedCount = stripped.filter((l) => /^\s*locked:\s*true\s*$/.test(l)).length;
  if (lockedCount !== LOCKED_ADRS.length) {
    violations.push(
      violation("locked-adr-guard", MANIFEST_PATH, 0, `locked marker count is ${lockedCount}, expected ${LOCKED_ADRS.length}`),
    );
  }
  return violations;
}

// --- Check 5: script names resolve ------------------------------------------
const NPM_RUN_RE = /npm run ([a-zA-Z0-9_:-]+)/g;

function checkScriptNamesResolve() {
  const violations = [];
  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const scripts = pkg.scripts || {};
  const files = scanSurface({ excludeChangelog: false });
  for (const rel of files) {
    const lines = readLines(rel);
    lines.forEach((line, idx) => {
      NPM_RUN_RE.lastIndex = 0;
      let m;
      while ((m = NPM_RUN_RE.exec(line)) !== null) {
        const scriptName = m[1];
        if (!(scriptName in scripts)) {
          violations.push(violation("script-names-resolve", rel, idx + 1, `no such npm script: ${scriptName}`));
        }
      }
    });
  }
  return violations;
}

// --- Check 6: credential shapes ----------------------------------------------
const UUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const STRIPE_KEY_RE = /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{20,}\b|\bwhsec_[A-Za-z0-9]{20,}\b/g;

function checkCredentialShapes() {
  const violations = [];
  const files = scanSurface({ excludeChangelog: false });
  for (const rel of files) {
    const lines = readLines(rel);
    lines.forEach((line, idx) => {
      for (const re of [UUID_RE, STRIPE_KEY_RE]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          violations.push(violation("credential-shapes", rel, idx + 1, `credential-shaped string: ${m[0]}`));
        }
      }
    });
  }
  return violations;
}

// --- Check 7: header convention ----------------------------------------------
function checkHeaderConvention() {
  const violations = [];
  for (const rel of docsTopLevelMarkdownFiles()) {
    const lines = readLines(rel);
    const first = lines[0] || "";
    if (!/^# /.test(first)) {
      violations.push(violation("header-convention", rel, 1, "first line is not a level-one heading"));
    }
    const statusIdx = lines.findIndex((l) => /^\*\*Status:\*\*\s*\S/.test(l));
    if (statusIdx < 0) {
      violations.push(violation("header-convention", rel, 1, "no `**Status:**` line in the header"));
    }
  }
  return violations;
}

function main() {
  try {
    const checks = [
      checkReferencesResolve,
      checkRelativeLinksResolve,
      checkManifestReconciliation,
      checkLockedAdrGuard,
      checkScriptNamesResolve,
      checkCredentialShapes,
      checkHeaderConvention,
    ];

    const violations = checks.flatMap((fn) => fn());

    if (violations.length === 0) {
      console.log(`[${TAG}] 0 violations`);
      process.exit(0);
    }

    for (const v of violations) {
      const loc = v.line ? `:${v.line}` : "";
      console.log(`${v.check}  ${v.file}${loc}  ${v.detail}`);
    }
    console.error(`[${TAG}] ABORT: ${violations.length} violation(s)`);
    process.exit(1);
  } catch (error) {
    console.error(`[${TAG}] ABORT: ${error.message}`);
    process.exit(1);
  }
}

main();
