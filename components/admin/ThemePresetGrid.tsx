"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";
import {
  APPEARANCE_SETTINGS_CATEGORY,
  APPEARANCE_THEME_SETTING_KEY,
} from "@/lib/themes/active-theme";
import { nextRovingIndex } from "./roving-index";

// Fixed chip order per 06-UI-SPEC.md's card anatomy (D-14).
const CHIP_ORDER: Array<keyof (typeof THEME_MANIFEST)[number]["tokens"]> = [
  "primary",
  "surface",
  "surfaceElevated",
  "foreground",
  "surfaceInverse",
];

type SettingRow = { key: string; value: string };
type SettingsResponse = { settings: SettingRow[] };

/** Reads the appearance.theme row out of a settings API response, falling back to the
 * manifest default for anything absent, unparseable, or outside the manifest — the same
 * allow-list posture getActiveTheme() uses server-side (06-02), applied client-side here
 * so the badge never claims a theme the storefront would not actually render.
 *
 * Exported so tests exercise the real parsing/allow-list logic directly, instead of
 * grepping the source file for its shape (06-REVIEW WR-03). */
export function extractThemeName(rows: SettingRow[]): string {
  const row = rows.find((candidate) => candidate.key === APPEARANCE_THEME_SETTING_KEY);
  if (!row) return DEFAULT_THEME_NAME;
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (typeof parsed === "string" && THEME_MANIFEST.some((theme) => theme.name === parsed)) {
      return parsed;
    }
  } catch {
    // Malformed stored value — fall through to the default below.
  }
  return DEFAULT_THEME_NAME;
}

/** Computes the next roving-tabindex index for an arrow-key press on the radiogroup,
 * wrapping at both ends. Re-exported from the shared roving-index module (07-REVIEW
 * WR-02) so this file keeps its existing export for callers/tests that import
 * nextRovingIndex from ThemePresetGrid directly, while LayoutSwitches's identical
 * keyboard math shares this same implementation instead of a verbatim copy. */
export { nextRovingIndex };

export type ThemePresetGridContentProps = {
  status: "loading" | "loaded" | "error";
  savedTheme: string | null;
  pendingTheme: string | null;
  saving: boolean;
  onSelectTheme: (name: string) => void;
  onGridKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onSave: () => void;
};

/**
 * Pure, props-driven view: no state, no effects, no fetch. Exported (and consumed by the
 * stateful ThemePresetGrid wrapper below) so tests can render real DOM output via
 * react-dom/server's renderToStaticMarkup and assert on actual behavior — manifest-driven
 * card count, Active-badge/Save-disabled state combinations, and ARIA roles — instead of
 * grepping the source file for literal substrings (06-REVIEW WR-03). This mirrors the
 * SubscriptionContent/SubscriptionManager split already used elsewhere in this test suite
 * (tests/unit/components/account/subscription-manager.test.ts).
 */
export function ThemePresetGridContent({
  status,
  savedTheme,
  pendingTheme,
  saving,
  onSelectTheme,
  onGridKeyDown,
  onSave,
}: ThemePresetGridContentProps) {
  const saveDisabled =
    status !== "loaded" || saving || !pendingTheme || pendingTheme === savedTheme;

  return (
    <div className="space-y-6">
      {status === "error" && (
        <div className="rounded-lg border border-red-800 bg-red-950 p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <p className="text-sm text-red-200">
              <strong>Settings could not be loaded.</strong> The fields below are showing
              defaults, not your stored values, so saving is disabled to keep it from
              overwriting them. Reload the page; if it keeps failing, check the browser
              console.
            </p>
          </div>
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Storefront theme"
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        onKeyDown={onGridKeyDown}
      >
        {THEME_MANIFEST.map((theme) => {
          const isSelected = (pendingTheme ?? savedTheme) === theme.name;
          const isPending = pendingTheme === theme.name;
          const isActive = status === "loaded" && savedTheme === theme.name;
          const rovingTarget = pendingTheme ?? savedTheme ?? THEME_MANIFEST[0]?.name;

          return (
            <Card
              key={theme.name}
              id={`theme-card-${theme.name}`}
              role="radio"
              aria-checked={isSelected}
              aria-label={theme.label}
              tabIndex={rovingTarget === theme.name ? 0 : -1}
              onClick={() => onSelectTheme(theme.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectTheme(theme.name);
                }
              }}
              className={`cursor-pointer border-neutral-700 bg-neutral-800 p-6 outline-none transition-colors ${
                isPending ? "border-orange-500 ring-2 ring-orange-500" : ""
              }`}
            >
              {/* 1. Colour chips — fixed order, inline style from this entry's own tokens (D-16). */}
              <div className="flex gap-2">
                {CHIP_ORDER.map((tokenKey) => (
                  <span
                    key={tokenKey}
                    className="h-6 w-6 rounded-full border border-neutral-600"
                    style={{ backgroundColor: theme.tokens[tokenKey] }}
                  />
                ))}
              </div>

              {/* 2. Mini mock — heading line + CTA pill, all values from this entry's own tokens. */}
              <div
                className="mt-4 flex h-24 flex-col justify-center gap-2 p-3"
                style={{
                  backgroundColor: theme.tokens.surfaceElevated,
                  borderRadius: theme.tokens.radiusMd,
                }}
              >
                <div
                  className="h-2 w-1/2 rounded-sm"
                  style={{ backgroundColor: theme.tokens.foreground }}
                />
                <span
                  className="inline-flex w-fit items-center px-3 py-1 text-xs"
                  style={{
                    backgroundColor: theme.tokens.primary,
                    color: theme.tokens.onPrimary,
                    borderRadius: theme.tokens.radiusSm,
                  }}
                >
                  Shop now
                </span>
              </div>

              {/* 3 + 6. Label and Active badge, on one row so a long label truncates instead
                  of pushing the badge onto a new line. */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-white">
                  {theme.label}
                </h3>
                {isActive && (
                  <Badge className="shrink-0 bg-green-600 text-white">Active</Badge>
                )}
              </div>

              {/* 4. Industry line — omitted entirely when absent, not an empty placeholder. */}
              {theme.meta.industry && (
                <p className="mt-1 text-xs text-gray-400">{theme.meta.industry}</p>
              )}

              {/* 5. Synopsis — clamped to 3 lines, omitted entirely when absent. */}
              {theme.meta.synopsis && (
                <p className="mt-2 line-clamp-3 text-sm text-gray-400">{theme.meta.synopsis}</p>
              )}
            </Card>
          );
        })}
      </div>

      <Button
        onClick={onSave}
        disabled={saveDisabled}
        title={
          status === "loaded"
            ? undefined
            : "Settings haven't loaded, so saving would overwrite them with defaults. Reload the page."
        }
        className="bg-orange-600 hover:bg-orange-700"
      >
        {saving ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}

export function ThemePresetGrid() {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [savedTheme, setSavedTheme] = useState<string | null>(null);
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/settings?category=${APPEARANCE_SETTINGS_CATEGORY}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings");
        const body = (await response.json()) as SettingsResponse;
        if (cancelled) return;
        setSavedTheme(extractThemeName(body.settings));
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTheme(name: string) {
    setPendingTheme(name);
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const currentName = pendingTheme ?? savedTheme ?? THEME_MANIFEST[0]?.name;
    const currentIndex = Math.max(
      0,
      THEME_MANIFEST.findIndex((theme) => theme.name === currentName),
    );
    const nextIndex = nextRovingIndex(currentIndex, event.key, THEME_MANIFEST.length);
    const next = THEME_MANIFEST[nextIndex];
    if (!next) return;
    selectTheme(next.name);
    document.getElementById(`theme-card-${next.name}`)?.focus();
  }

  async function save() {
    // The pending name can only ever come from selectTheme(theme.name), which only ever
    // receives a manifest entry's own name — but the read-time check in 06-02 is the
    // authoritative gate, so this re-check is a cheap first line, not the real control.
    if (!pendingTheme || !THEME_MANIFEST.some((theme) => theme.name === pendingTheme)) return;
    if (pendingTheme === savedTheme) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              key: APPEARANCE_THEME_SETTING_KEY,
              value: pendingTheme,
              category: APPEARANCE_SETTINGS_CATEGORY,
              data_type: "string",
            },
          ],
        }),
      });
      if (!response.ok) throw new Error("Save failed");

      // Re-read the stored value from the endpoint's own response rather than assuming
      // the optimistic pendingTheme — the settings endpoint is last-write-wins, so a
      // concurrent admin save must not leave this page showing a value the storefront
      // is not serving.
      const body = (await response.json()) as SettingsResponse;
      const confirmedName = extractThemeName(body.settings);
      const label = THEME_MANIFEST.find((theme) => theme.name === pendingTheme)?.label ?? pendingTheme;
      setSavedTheme(confirmedName);
      setPendingTheme(null);
      toast.success(`Theme updated to ${label}.`);
    } catch {
      toast.error("Couldn't save your theme selection. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemePresetGridContent
      status={status}
      savedTheme={savedTheme}
      pendingTheme={pendingTheme}
      saving={saving}
      onSelectTheme={selectTheme}
      onGridKeyDown={handleGridKeyDown}
      onSave={() => void save()}
    />
  );
}
