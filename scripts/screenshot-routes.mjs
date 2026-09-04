#!/usr/bin/env node
/**
 * Captures deterministic, multi-viewport, multi-state screenshots of the storefront's
 * screenshot-coverage grid (05-TOKEN-MAP.md §8) and appends a coverage table to a manifest.
 *
 * Never points at a non-localhost base URL without --allow-remote: the account, checkout,
 * and order-status routes can render real customer names, addresses, and order contents.
 */
import { mkdirSync, readFileSync, appendFileSync, existsSync, statSync, readdirSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const TAG = "screenshot-routes";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
}
function hasFlag(name) {
  return args.includes(name);
}

const BASE_URL = flag("--base-url", "http://localhost:3000");
const LABEL = flag("--label");
const ORDER_ID = flag("--order-id");
const ALLOW_MISSING = hasFlag("--allow-missing");
const ALLOW_REMOTE = hasFlag("--allow-remote");
const MANIFEST_PATH = flag("--manifest", ".planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md");

if (!LABEL) {
  console.error(
    "Usage: node scripts/screenshot-routes.mjs --label <name> [--base-url <url>] [--order-id <id>] [--allow-missing] [--allow-remote] [--manifest <path>]",
  );
  process.exit(1);
}

const OUTPUT_ROOT = ".screenshots";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

// The only two interactive-state selectors the coverage grid needs: opening the header nav
// (desktop "Categories" dropdown or mobile hamburger sheet) and opening the cart drawer.
const NAV_TRIGGER_SELECTOR = {
  "1280": 'button:has-text("Categories"):visible',
  "390": '[aria-label="Open navigation menu"]:visible',
};
// The header renders a CartTrigger in both the desktop and mobile nav blocks (only one is
// visible per viewport via `hidden md:flex` / `md:hidden`), so scope to the visible instance.
const CART_TRIGGER_SELECTOR = 'button[aria-label^="Cart ("]:visible';

async function openState(page, viewportName, state) {
  if (state === "resting") return;
  if (state === "nav-open") {
    await page.click(NAV_TRIGGER_SELECTOR[viewportName]);
    await page.waitForTimeout(350);
    return;
  }
  if (state === "cart-open") {
    await page.click(CART_TRIGGER_SELECTOR);
    await page.waitForTimeout(350);
    return;
  }
  throw new Error(`unknown state "${state}"`);
}

async function resolveSitemapSlugs(baseUrl) {
  const res = await fetch(new URL("/sitemap.xml", baseUrl).href);
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  // The sitemap emits absolute URLs built from the store's configured site URL (which may be
  // an unconfigured placeholder in local dev), not necessarily --base-url. Only the path is
  // meaningful here; re-resolve it against baseUrl so captures always hit the target host.
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const productPath = paths.find((p) => /^\/product\/[^/]+\/?$/.test(p));
  const categoryPath = paths.find((p) => /^\/category\/[^/]+\/?$/.test(p));
  return {
    product: productPath ? new URL(productPath, baseUrl).href : undefined,
    category: categoryPath ? new URL(categoryPath, baseUrl).href : undefined,
  };
}

function buildCoverageGrid({ productUrl, categoryUrl, baseUrl, orderId }) {
  // route key -> { url, states }. `url: null` means the route's prerequisite could not
  // be resolved; every (viewport, state) pair for that route becomes a MISSING row.
  const routes = {
    home: { url: new URL("/", baseUrl).href, states: ["resting", "nav-open"], missingReason: null },
    category: {
      url: categoryUrl ?? null,
      states: ["resting", "nav-open"],
      missingReason: categoryUrl ? null : "no category slug resolved from /sitemap.xml",
    },
    product: {
      url: productUrl ?? null,
      states: ["resting", "nav-open"],
      missingReason: productUrl ? null : "no product slug resolved from /sitemap.xml",
    },
    // The cart cell is the home route with the cart drawer opened — there is no
    // standalone /cart route. Only the "open" state applies; its resting state is
    // identical to the home cell's resting state.
    cart: { url: new URL("/", baseUrl).href, states: ["cart-open"], missingReason: null },
    checkout: { url: new URL("/checkout", baseUrl).href, states: ["resting", "nav-open"], missingReason: null },
    account: { url: new URL("/account", baseUrl).href, states: ["resting", "nav-open"], missingReason: null },
    "order-status": {
      url: orderId ? new URL(`/order-status/${orderId}`, baseUrl).href : null,
      states: ["resting", "nav-open"],
      missingReason: orderId ? null : "no order id available (pass --order-id, or local D1 seed has no orders)",
    },
  };

  const cells = [];
  for (const [route, def] of Object.entries(routes)) {
    for (const viewport of VIEWPORTS) {
      for (const state of def.states) {
        cells.push({
          route,
          url: def.url,
          missingReason: def.missingReason,
          viewport: viewport.name,
          viewportDef: viewport,
          state,
        });
      }
    }
  }
  return cells;
}

function dedupeKey(cell) {
  return `${cell.url}::${cell.viewport}::${cell.state}`;
}

async function main() {
  const hostname = new URL(BASE_URL).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && !ALLOW_REMOTE) {
    throw new Error(
      `refusing non-localhost base URL "${BASE_URL}" without --allow-remote: the account, checkout, and ` +
        "order-status routes render real customer names, addresses, and order contents, so pointing this " +
        "harness at a live store must be a deliberate act, not a default.",
    );
  }

  const { product: productUrl, category: categoryUrl } = await resolveSitemapSlugs(BASE_URL);
  const cells = buildCoverageGrid({ productUrl, categoryUrl, baseUrl: BASE_URL, orderId: ORDER_ID });

  const outDir = `${OUTPUT_ROOT}/${LABEL}`;
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const seen = new Map(); // dedupeKey -> row (first cell to claim a (url,viewport,state) wins)
  const rows = [];
  let missingCount = 0;
  let capturedCount = 0;

  try {
    for (const cell of cells) {
      if (!cell.url) {
        rows.push({
          route: cell.route,
          viewport: cell.viewport,
          state: "MISSING",
          path: "",
          hash: "",
          notes: cell.missingReason,
        });
        missingCount += 1;
        continue;
      }

      const key = dedupeKey(cell);
      if (seen.has(key)) {
        // Same resolved URL + viewport + state as an earlier cell: reuse its row rather
        // than racing another capture for the same filename.
        rows.push({ ...seen.get(key), route: `${seen.get(key).route} (= ${cell.route})` });
        continue;
      }

      const filename = `${cell.route}__${cell.viewport}__${cell.state}.png`;
      const filePath = `${outDir}/${filename}`;

      const context = await browser.newContext({
        viewport: { width: cell.viewportDef.width, height: cell.viewportDef.height },
      });
      const page = await context.newPage();
      try {
        await page.goto(cell.url, { waitUntil: "networkidle" });
        await openState(page, cell.viewport, cell.state);
        await page.screenshot({ path: filePath, fullPage: false });
      } finally {
        await context.close();
      }

      const hash = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      const row = { route: cell.route, viewport: cell.viewport, state: cell.state, path: filePath, hash, notes: "" };
      seen.set(key, row);
      rows.push(row);
      capturedCount += 1;
    }
  } finally {
    await browser.close();
  }

  appendManifest(MANIFEST_PATH, LABEL, rows);

  console.log(`[${TAG}] captured ${capturedCount} cell(s), ${missingCount} missing`);
  if (missingCount > 0 && !ALLOW_MISSING) process.exit(1);
  process.exit(0);
}

function appendManifest(manifestPath, label, rows) {
  const header = `\n## Label: \`${label}\`\n\n| Route | Viewport | State | Path | Hash | Notes |\n|---|---|---|---|---|---|\n`;
  const body = rows
    .map(
      (r) =>
        `| ${r.route} | ${r.viewport} | ${r.state} | ${r.path || "-"} | ${r.hash || "-"} | ${r.notes || "-"} |`,
    )
    .join("\n");
  appendFileSync(manifestPath, `${header}${body}\n`);
}

try {
  await main();
} catch (error) {
  console.error(`[${TAG}] ABORT: ${error.message}`);
  process.exit(1);
}
