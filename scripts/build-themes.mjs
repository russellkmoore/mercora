#!/usr/bin/env node
/**
 * Theme file validator plus manifest/barrel codegen (THEME-01).
 *
 * Scans a theme directory (default `themes/`) for `*.css` files, validates
 * each against the frozen 23-token contract and a strict single-rule
 * structural shape, then generates:
 *   - themes/index.generated.css       (one @import per theme, filename order)
 *   - lib/themes/manifest.generated.ts (typed THEME_MANIFEST array)
 *
 * Both generated files are committed to git (D-08) and regenerated on
 * `predev` / `build:worker`. `--check` verifies the committed output is
 * fresh without writing anything (CI freshness gate).
 *
 * See .planning/phases/06-theme-file-mechanism-presets/06-CONTEXT.md D-05
 * through D-08 for the full contract this script enforces.
 */
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";

const TAG = "build-themes";
const REPO_ROOT = process.cwd();
const DEFAULT_THEME_DIR = "themes";
const MANIFEST_PATH = "lib/themes/manifest.generated.ts";
const BARREL_PATH = "themes/index.generated.css";
const GENERATED_BARREL_FILENAME = "index.generated.css";
const DEFAULT_THEME_NAME = "volt-dark";

// The 23-token contract (05-TOKEN-MAP.md §1), kebab-case with the
// `--store-` prefix, in the same order as lib/themes/tokens.ts's
// ThemeTokens type. Frozen one-way (Phase 5 D-01) — never widen, narrow,
// or reorder this list from this phase.
const REQUIRED_TOKENS = [
  "--store-primary",
  "--store-on-primary",
  "--store-surface",
  "--store-surface-elevated",
  "--store-foreground",
  "--store-muted-foreground",
  "--store-border",
  "--store-ring",
  "--store-success",
  "--store-warning",
  "--store-danger",
  "--store-info",
  "--store-surface-inverse",
  "--store-surface-inverse-elevated",
  "--store-on-inverse",
  "--store-muted-on-inverse",
  "--store-border-inverse",
  "--store-radius-sm",
  "--store-radius-md",
  "--store-radius-lg",
  "--store-radius-xl",
  "--store-font-sans",
  "--store-font-display",
];

// The 17 colour tokens (radius + font tokens are not hex-checked).
const COLOUR_TOKENS = new Set(
  REQUIRED_TOKENS.filter((t) => !t.includes("radius") && !t.includes("font")),
);

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Maps a `--store-kebab-name` CSS custom property (prefix stripped) to camelCase. */
function kebabToCamel(kebab) {
  return kebab.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

const TOKEN_TS_KEYS = REQUIRED_TOKENS.map((t) => kebabToCamel(t.replace(/^--store-/, "")));

/**
 * Parses a `/* @theme label: ... | industry: ... | synopsis: ... *\/` header
 * comment out of raw CSS source (D-05). Field order is not enforced; each
 * pipe-delimited segment is read as `key: value`. Returns null when no
 * `@theme` comment is present, or when it carries no `label` field.
 */
export function parseThemeHeader(cssSource) {
  const match = cssSource.match(/\/\*\s*@theme([\s\S]*?)\*\//);
  if (!match) return null;

  const fields = {};
  for (const part of match[1].split("|")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key && value) fields[key] = value;
  }

  if (!fields.label) return null;

  return {
    label: fields.label,
    industry: fields.industry,
    synopsis: fields.synopsis,
  };
}

/**
 * Validates a single theme file's structure and token contract (D-06/D-07).
 * Returns an array of `{ file, line, message }`; empty means valid. Collects
 * every violation rather than stopping at the first, per RESEARCH Pattern 1.
 */
export function validateThemeFile(filePath, cssSource) {
  const errors = [];
  const stem = path.basename(filePath, ".css");

  if (!cssSource || !cssSource.trim()) {
    errors.push({ file: filePath, line: 1, message: "theme file is empty" });
    return errors;
  }

  let root;
  try {
    root = postcss.parse(cssSource, { from: filePath });
  } catch (error) {
    errors.push({
      file: filePath,
      line: error.line ?? 1,
      message: `unparseable CSS: ${error.reason ?? error.message}`,
    });
    return errors;
  }

  root.walkAtRules((atRule) => {
    errors.push({
      file: filePath,
      line: atRule.source?.start?.line ?? 1,
      message: `disallowed at-rule "@${atRule.name}" — a theme file may not use at-rules`,
    });
  });

  const rules = [];
  root.walkRules((rule) => rules.push(rule));

  if (rules.length === 0) {
    errors.push({
      file: filePath,
      line: 1,
      message: `no rule found; expected exactly one [data-theme="${stem}"] block`,
    });
  } else if (rules.length > 1) {
    for (const extra of rules.slice(1)) {
      errors.push({
        file: filePath,
        line: extra.source?.start?.line ?? 1,
        message: `unexpected extra rule "${extra.selector}" — a theme file may contain exactly one rule`,
      });
    }
  }

  if (!NAME_RE.test(stem)) {
    errors.push({
      file: filePath,
      line: 1,
      message: `filename stem "${stem}" must be lowercase alphanumerics and hyphens only`,
    });
  }

  const primaryRule = rules[0];
  if (primaryRule) {
    const expectedSelector = `[data-theme="${stem}"]`;
    if (primaryRule.selector !== expectedSelector) {
      errors.push({
        file: filePath,
        line: primaryRule.source?.start?.line ?? 1,
        message: `selector "${primaryRule.selector}" must equal "${expectedSelector}" (the filename stem)`,
      });
    }

    const declared = new Set();
    primaryRule.walkDecls((decl) => {
      const line = decl.source?.start?.line ?? 1;
      if (!decl.prop.startsWith("--store-")) {
        errors.push({ file: filePath, line, message: `non-token declaration "${decl.prop}"` });
        return;
      }
      declared.add(decl.prop);
      if (COLOUR_TOKENS.has(decl.prop) && !HEX_RE.test(decl.value.trim())) {
        errors.push({
          file: filePath,
          line,
          message: `token "${decl.prop}" must be a 6-digit hex colour, got "${decl.value.trim()}"`,
        });
      }
    });

    for (const token of REQUIRED_TOKENS) {
      if (!declared.has(token)) {
        errors.push({
          file: filePath,
          line: primaryRule.source?.start?.line ?? 1,
          message: `missing required token "${token}"`,
        });
      }
    }
    for (const token of declared) {
      if (!REQUIRED_TOKENS.includes(token)) {
        errors.push({
          file: filePath,
          line: primaryRule.source?.start?.line ?? 1,
          message: `unknown token "${token}" is not part of the frozen 23-token contract`,
        });
      }
    }
  }

  const header = parseThemeHeader(cssSource);
  if (!header) {
    errors.push({
      file: filePath,
      line: 1,
      message: "missing required @theme header label (e.g. /* @theme label: My Theme */)",
    });
  }

  return errors;
}

/**
 * Scans `themeDir` for `*.css` files (excluding the generated barrel),
 * validates each, and returns `{ entries, errors }`. `entries` is empty
 * whenever any error exists — codegen only runs after every file validates.
 */
export function buildManifest(themeDir) {
  const errors = [];
  const entries = [];

  const absDir = path.resolve(REPO_ROOT, themeDir);
  let files;
  try {
    files = readdirSync(absDir)
      .filter((f) => f.endsWith(".css") && f !== GENERATED_BARREL_FILENAME)
      .sort();
  } catch (error) {
    errors.push({ file: themeDir, line: 1, message: `cannot read theme directory: ${error.message}` });
    return { entries, errors };
  }

  if (files.length === 0) {
    errors.push({ file: themeDir, line: 1, message: `no theme files found in "${themeDir}"` });
    return { entries, errors };
  }

  for (const file of files) {
    const relPath = path.join(themeDir, file);
    const absPath = path.join(absDir, file);
    let source;
    try {
      source = readFileSync(absPath, "utf8");
    } catch (error) {
      errors.push({ file: relPath, line: 1, message: `cannot read file: ${error.message}` });
      continue;
    }

    const fileErrors = validateThemeFile(relPath, source);
    if (fileErrors.length > 0) {
      errors.push(...fileErrors);
      continue;
    }

    const stem = path.basename(file, ".css");
    const header = parseThemeHeader(source);
    const root = postcss.parse(source, { from: relPath });
    const rule = root.nodes.find((node) => node.type === "rule");

    const tokens = {};
    rule.walkDecls((decl) => {
      const kebab = decl.prop.replace(/^--store-/, "");
      const camel = kebabToCamel(kebab);
      let value = decl.value.trim();
      if (COLOUR_TOKENS.has(decl.prop)) value = value.toLowerCase();
      tokens[camel] = value;
    });

    entries.push({
      name: stem,
      label: header.label,
      meta: { industry: header.industry, synopsis: header.synopsis },
      tokens,
    });
  }

  if (errors.length > 0) return { entries: [], errors };
  return { entries, errors };
}

/** Renders the full text of lib/themes/manifest.generated.ts. */
export function renderManifestModule(entries) {
  const lines = [];
  lines.push("/**");
  lines.push(" * GENERATED FILE — DO NOT EDIT.");
  lines.push(" *");
  lines.push(" * Produced by scripts/build-themes.mjs from themes/*.css. Edit the theme");
  lines.push(" * files instead, then rerun `npm run build:themes` (or `predev` /");
  lines.push(" * `build:worker`, which run it automatically) to regenerate this file.");
  lines.push(" *");
  lines.push(" * Plain data only — no imports, no environment reads. This module is");
  lines.push(" * pulled into the browser bundle through lib/themes/tokens.ts.");
  lines.push(" */");
  lines.push("");
  lines.push("export type ThemeTokenValues = {");
  for (const key of TOKEN_TS_KEYS) {
    lines.push(`  ${key}: string;`);
  }
  lines.push("};");
  lines.push("");
  lines.push("export type ThemeManifestEntry = {");
  lines.push("  name: string;");
  lines.push("  label: string;");
  lines.push("  meta: { industry?: string; synopsis?: string };");
  lines.push("  tokens: ThemeTokenValues;");
  lines.push("};");
  lines.push("");
  lines.push("export const THEME_MANIFEST: ThemeManifestEntry[] = [");
  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    name: ${JSON.stringify(entry.name)},`);
    lines.push(`    label: ${JSON.stringify(entry.label)},`);
    const metaParts = [];
    if (entry.meta.industry) metaParts.push(`industry: ${JSON.stringify(entry.meta.industry)}`);
    if (entry.meta.synopsis) metaParts.push(`synopsis: ${JSON.stringify(entry.meta.synopsis)}`);
    lines.push(`    meta: { ${metaParts.join(", ")} },`);
    lines.push("    tokens: {");
    for (const key of TOKEN_TS_KEYS) {
      lines.push(`      ${key}: ${JSON.stringify(entry.tokens[key])},`);
    }
    lines.push("    },");
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  lines.push(`export const DEFAULT_THEME_NAME = ${JSON.stringify(DEFAULT_THEME_NAME)};`);
  lines.push("");
  return lines.join("\n");
}

/** Renders the full text of themes/index.generated.css. */
export function renderBarrelCss(entries) {
  const lines = [];
  lines.push("/* GENERATED FILE — DO NOT EDIT. Produced by scripts/build-themes.mjs from themes/*.css. */");
  for (const entry of entries) {
    lines.push(`@import './${entry.name}.css';`);
  }
  lines.push("");
  return lines.join("\n");
}

function writeAtomic(targetPath, content) {
  const absTarget = path.resolve(REPO_ROOT, targetPath);
  const tmpPath = `${absTarget}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, absTarget);
}

function fileMatches(targetPath, expectedContent) {
  const absTarget = path.resolve(REPO_ROOT, targetPath);
  if (!existsSync(absTarget)) return false;
  return readFileSync(absTarget, "utf8") === expectedContent;
}

function parseArgs(argv) {
  const args = { check: false, json: false, path: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--path") args.path = argv[++i];
  }
  return args;
}

function report(errors, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify({ errors })}\n`);
    return;
  }
  for (const e of errors) {
    console.error(`[${TAG}] ${e.file}:${e.line}: ${e.message}`);
  }
  console.error(`[${TAG}] ABORT: ${errors.length} error(s).`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scanDir = args.path || DEFAULT_THEME_DIR;
  const isDefaultDir = path.resolve(REPO_ROOT, scanDir) === path.resolve(REPO_ROOT, DEFAULT_THEME_DIR);

  const { entries, errors } = buildManifest(scanDir);

  if (errors.length > 0) {
    report(errors, args.json);
    process.exit(1);
  }

  const manifestSource = renderManifestModule(entries);
  const barrelSource = renderBarrelCss(entries);

  if (args.check) {
    if (!isDefaultDir) {
      console.error(`[${TAG}] ABORT: --check requires the default themes directory, got "${scanDir}"`);
      process.exit(1);
    }
    const stale = [];
    if (!fileMatches(MANIFEST_PATH, manifestSource)) stale.push(MANIFEST_PATH);
    if (!fileMatches(BARREL_PATH, barrelSource)) stale.push(BARREL_PATH);
    if (stale.length > 0) {
      console.error(
        `[${TAG}] ABORT: stale generated file(s): ${stale.join(", ")}. Run \`node scripts/build-themes.mjs\` to regenerate and commit the result.`,
      );
      process.exit(1);
    }
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ errors: [], stale: [], themeCount: entries.length })}\n`);
    } else {
      console.log(`[${TAG}] check passed — generated output for ${entries.length} theme(s) is fresh.`);
    }
    process.exit(0);
  }

  if (!isDefaultDir) {
    // Scoped/fixture run: validate and render in memory only. The output
    // paths are fixed regardless of --path, so writing here would corrupt
    // the real generated files during a fixture-directed run.
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ errors: [], entries })}\n`);
    } else {
      console.log(`[${TAG}] ${entries.length} theme(s) valid under "${scanDir}" (dry run, no files written).`);
    }
    process.exit(0);
  }

  writeAtomic(MANIFEST_PATH, manifestSource);
  writeAtomic(BARREL_PATH, barrelSource);
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ errors: [], entries, written: [MANIFEST_PATH, BARREL_PATH] })}\n`);
  } else {
    console.log(`[${TAG}] generated manifest and barrel for ${entries.length} theme(s).`);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
