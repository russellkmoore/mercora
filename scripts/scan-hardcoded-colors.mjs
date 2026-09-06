#!/usr/bin/env node
/**
 * Whole-tree scan for hardcoded palette values (hex literals, rgb()/hsl()
 * functional colors, and raw Tailwind/shadcn palette utility classes).
 *
 * This is the phase's completion gate: TOKEN-03 is satisfied only when this
 * script reports 0 violations across the whole storefront tree. See
 * .planning/phases/05-token-contract-component-sweep/05-TOKEN-MAP.md §6 for
 * the frozen scan scope, exclusion rules, and manual-review registry this
 * script implements.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const TAG = "scan-tokens";
const REPO_ROOT = process.cwd();

// Walk roots (D-14 / TOKEN-MAP §6): four directories plus one standalone file.
const DEFAULT_ROOTS = ["app", "components", "lib", "themes", "tailwind.config.ts"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

// The only path-based exclusion the phase permits (D-14): any directory
// segment named "admin", covering both storefront admin trees.
const EXCLUDED_DIR_SEGMENT = "admin";

// Theme source of truth (TOKEN-MAP §6): hex literals are legal here and
// produce no finding. These files are skipped entirely, not filtered.
const THEME_SOURCE_DIR = "themes";
const THEME_SOURCE_FILES = new Set(["lib/themes/tokens.ts", "lib/themes/manifest.generated.ts"]);

// Named-file exceptions (T-05-01-01): each carries a written reason and is
// printed on every run, so a clean verdict can never be silent about what it
// could not see. These files are excluded from scanning, not just flagged.
const MANUAL_REVIEW = [
  {
    file: "lib/utils/image-placeholders.ts",
    reason:
      "the blurDataURL constants are base64 data URIs; the palette values are inside the encoded payload where no text scan can reach, and no theme can correct a data URI without a build-time regeneration step that does not exist until Phase 6 at the earliest",
  },
  {
    file: "lib/types/mach/Promotion.ts",
    reason:
      "the single hex is highlight_color inside an example promotion fixture — merchant-authored per-promotion display data, not app chrome; a theme must not dictate promotion badge colours",
  },
];

// --- Finding class 1: hex literals -----------------------------------------
// 3, 4, 6, or 8 hex digits following `#`, not part of a longer hex run.
const HEX_RE = /(?<![#0-9a-fA-F])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

// --- Finding class 2: functional colors -------------------------------------
// rgb(/rgba(/hsl(/hsla( immediately followed by a digit. This deliberately
// excludes `rgb(from var(--store-primary) r g b / <alpha-value>)`, the
// token-driven construct tailwind.config.ts uses today.
const FUNC_COLOR_RE = /\b(?:rgb|rgba|hsl|hsla)\(\d[^)]*\)/g;

// --- Finding classes 3 & 4: Tailwind palette utilities + dead shadcn vocab -
// Prefixes shared by both finding classes (TOKEN-MAP task text: "behind the
// same prefix and variant-chain rules").
const PREFIXES = [
  "bg", "text", "border", "ring", "from", "to", "via", "fill", "stroke",
  "divide", "outline", "decoration", "caret", "accent", "shadow", "placeholder",
];

// -foreground compounds must be matched as a unit so `muted-foreground` (a
// real contract token) is never treated as `muted` + a dangling suffix.
const COMPOUND_FAMILIES = [
  "primary-foreground", "secondary-foreground", "accent-foreground",
  "card-foreground", "popover-foreground",
];

const COLOR_FAMILIES = [
  "gray", "neutral", "zinc", "slate", "stone", "orange", "red", "green",
  "blue", "amber", "yellow", "emerald", "lime", "teal", "cyan", "sky",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose", "white", "black",
];

// The shadcn vocabulary this codebase never defined (D-17). `muted-foreground`
// is deliberately absent — it is a real token, not dead vocabulary.
const SHADCN_FAMILIES = [
  "popover", "accent", "muted", "destructive", "card", "secondary", "input", "background",
];

const FAMILY_ALT = [...COMPOUND_FAMILIES, ...COLOR_FAMILIES, ...SHADCN_FAMILIES].join("|");
const PREFIX_ALT = PREFIXES.join("|");

// No explicit variant-chain group is needed: any variant chain (including
// arbitrary-value variants like `data-[state=open]:`) ends in `:`, and `:`
// alone already satisfies the "not preceded by a word/hyphen char" boundary
// below — so an arbitrary chain in front is allowed without being matched.
const TAILWIND_RE = new RegExp(
  `(?<![\\w-])(?:${PREFIX_ALT})-(?:${FAMILY_ALT})(?:-\\d{1,3})?(?![\\w-])`,
  "g",
);

function parseArgs(argv) {
  const args = { path: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--path") args.path = argv[++i];
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isAdminExcluded(rel) {
  return rel.split("/").includes(EXCLUDED_DIR_SEGMENT);
}

function isThemeSource(rel) {
  return rel === THEME_SOURCE_DIR || rel.startsWith(`${THEME_SOURCE_DIR}/`) || THEME_SOURCE_FILES.has(rel);
}

function isManualReview(rel) {
  return MANUAL_REVIEW.some((entry) => entry.file === rel);
}

/** Recursively collects scannable file paths (relative, posix) under `root`. */
function walk(root, out) {
  const abs = path.join(REPO_ROOT, root);
  if (!existsSync(abs)) return; // walk roots may not exist yet (e.g. themes/)
  const stat = statSync(abs);
  if (stat.isFile()) {
    out.push(root);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === EXCLUDED_DIR_SEGMENT) continue; // never descend into admin/
    const rel = toPosix(path.join(root, entry.name));
    if (entry.isDirectory()) {
      walk(rel, out);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(rel);
    }
  }
}

function collectCandidates(scopedPath) {
  const out = [];
  if (scopedPath) {
    const rel = toPosix(path.relative(REPO_ROOT, path.resolve(REPO_ROOT, scopedPath)));
    walk(rel, out);
  } else {
    for (const root of DEFAULT_ROOTS) walk(root, out);
  }
  return out;
}

/**
 * Blanks out region-sentinel content (`gsd:scan-ignore-start` /
 * `gsd:scan-ignore-end`), run BEFORE comment stripping per TOKEN-MAP §6
 * ("Sentinels are parsed before comment stripping"). Preserves line length
 * (spaces, not removal) so column math for later files stays untouched, and
 * throws on an unclosed region so a truncated sentinel is never silently
 * skipped.
 */
function applySentinels(lines, relPath) {
  let inRegion = false;
  const out = lines.slice();
  for (let i = 0; i < out.length; i++) {
    const line = out[i];
    if (line.includes("gsd:scan-ignore-start")) {
      inRegion = true;
      out[i] = " ".repeat(line.length);
      continue;
    }
    if (line.includes("gsd:scan-ignore-end")) {
      inRegion = false;
      out[i] = " ".repeat(line.length);
      continue;
    }
    if (inRegion) out[i] = " ".repeat(line.length);
  }
  if (inRegion) {
    throw new Error(`unclosed gsd:scan-ignore-start region in ${relPath}`);
  }
  return out;
}

/**
 * Blanks out comment bodies (`//` to end of line for non-CSS files, `/* *\/`
 * block comments for all files) while leaving string contents and newlines
 * untouched, so column numbers stay accurate. This is what keeps JSDoc
 * examples and CSS shade annotations from registering as violations.
 */
function stripComments(text, isCss) {
  const src = text;
  const out = src.split("");
  let inString = null; // '"' | "'" | "`" | null
  let inBlock = false;
  let inLine = false;

  for (let i = 0; i < out.length; i++) {
    const c = src[i];
    const next = src[i + 1];

    if (inLine) {
      if (c === "\n") inLine = false;
      else out[i] = " ";
      continue;
    }

    if (inBlock) {
      if (c === "\n") continue; // preserve line breaks
      if (c === "*" && next === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        inBlock = false;
        i++;
        continue;
      }
      out[i] = " ";
      continue;
    }

    if (inString) {
      if (c === "\\") {
        i++; // skip escaped char, leave both untouched
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }

    if (!isCss && c === "/" && next === "/") {
      out[i] = " ";
      out[i + 1] = " ";
      inLine = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      inBlock = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || (!isCss && c === "`")) {
      inString = c;
      continue;
    }
  }

  if (inBlock) {
    throw new Error("unterminated block comment");
  }
  return out.join("");
}

function findMatches(line, re) {
  const results = [];
  re.lastIndex = 0;
  let m = re.exec(line);
  while (m !== null) {
    results.push({ col: m.index + 1, match: m[0] });
    m = re.exec(line);
  }
  return results;
}

function scanFile(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  const raw = readFileSync(abs, "utf8");
  const ext = path.extname(relPath);
  const lines = raw.split("\n");
  const sentineled = applySentinels(lines, relPath);
  const stripped = stripComments(sentineled.join("\n"), ext === ".css").split("\n");

  const findings = [];
  stripped.forEach((line, idx) => {
    const lineNo = idx + 1;
    for (const re of [HEX_RE, FUNC_COLOR_RE, TAILWIND_RE]) {
      for (const { col, match } of findMatches(line, re)) {
        findings.push({ path: relPath, line: lineNo, col, match });
      }
    }
  });
  return findings;
}

function main() {
  try {
    const { path: scopedPath, json } = parseArgs(process.argv.slice(2));

    const candidates = collectCandidates(scopedPath)
      .filter((rel) => !isAdminExcluded(rel))
      .filter((rel) => !isThemeSource(rel))
      .filter((rel) => !isManualReview(rel));

    const findings = [];
    for (const rel of candidates) {
      findings.push(...scanFile(rel));
    }

    findings.sort((a, b) => {
      if (a.path !== b.path) return a.path < b.path ? -1 : 1;
      if (a.line !== b.line) return a.line - b.line;
      return a.col - b.col;
    });

    if (json) {
      process.stdout.write(`${JSON.stringify({ findings, manualReview: MANUAL_REVIEW })}\n`);
    } else {
      for (const entry of MANUAL_REVIEW) {
        console.log(`MANUAL-REVIEW  ${entry.file}  — ${entry.reason}`);
      }
      for (const f of findings) {
        console.log(`${f.path}:${f.line}:${f.col}  ${f.match}`);
      }
    }

    if (findings.length === 0) {
      if (!json) console.log(`[${TAG}] 0 violations`);
      process.exit(0);
    } else {
      const fileCount = new Set(findings.map((f) => f.path)).size;
      if (!json) console.error(`[${TAG}] ABORT: ${findings.length} violation(s) in ${fileCount} file(s)`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[${TAG}] ABORT: ${error.message}`);
    process.exit(1);
  }
}

main();
