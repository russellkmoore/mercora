"use client";

import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  AlertCircle,
  Columns2,
  GalleryHorizontal,
  LayoutGrid,
  LayoutList,
  PanelLeft,
  PanelTop,
  RefreshCw,
  Save,
  SquareSplitHorizontal,
  TextAlignCenter,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CATEGORY_LAYOUTS,
  HOME_HEROES,
  PRODUCT_GALLERIES,
  DEFAULT_LAYOUTS,
} from "@/lib/layout/variants";
import { LAYOUT_SETTING_KEYS } from "@/lib/layout/settings";
import { APPEARANCE_SETTINGS_CATEGORY } from "@/lib/themes/active-theme";

type SettingRow = { key: string; value: string };
type SettingsResponse = { settings: SettingRow[] };

/**
 * The three layout switches' currently-resolved values, always members of
 * their own enum (lib/layout/variants.ts) — never a bare string.
 */
export type LayoutSelections = {
  categoryLayout: (typeof CATEGORY_LAYOUTS)[number];
  homeHero: (typeof HOME_HEROES)[number];
  productGallery: (typeof PRODUCT_GALLERIES)[number];
};

type SwitchId = keyof LayoutSelections;

/**
 * Resolves one switch's stored row against its own enum array by membership
 * (never by indexing an object with the stored string), falling back to
 * that switch's default for anything absent, unparseable, of the wrong
 * type, or outside its own allow-list. Mirrors getLayoutSettings()'s own
 * allow-list posture client-side (T-07-14) so the highlighted option can
 * never claim a layout the storefront would not actually render.
 */
function extractOne<T extends string>(
  rows: SettingRow[],
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (typeof parsed === "string" && (allowed as readonly string[]).includes(parsed)) {
      return parsed as T;
    }
  } catch {
    // Malformed stored value — fall through to the default below.
  }
  return fallback;
}

/**
 * Reads all three layout selections out of a settings API response. Exported
 * so tests drive the real parsing/allow-list logic directly (mirrors
 * ThemePresetGrid's extractThemeName — 06-REVIEW WR-03 precedent), rather
 * than grepping the source file for its shape.
 */
export function extractLayoutSelections(rows: SettingRow[]): LayoutSelections {
  return {
    categoryLayout: extractOne(
      rows,
      LAYOUT_SETTING_KEYS.categoryLayout,
      CATEGORY_LAYOUTS,
      DEFAULT_LAYOUTS.categoryLayout,
    ),
    homeHero: extractOne(
      rows,
      LAYOUT_SETTING_KEYS.homeHero,
      HOME_HEROES,
      DEFAULT_LAYOUTS.homeHero,
    ),
    productGallery: extractOne(
      rows,
      LAYOUT_SETTING_KEYS.productGallery,
      PRODUCT_GALLERIES,
      DEFAULT_LAYOUTS.productGallery,
    ),
  };
}

/**
 * Computes the next roving-tabindex index for an arrow-key press inside one
 * segmented group, wrapping at both ends. Copied verbatim from
 * ThemePresetGrid.tsx (07-PATTERNS.md) so all three groups (and the theme
 * grid) share the exact same keyboard math, unit-tested directly since this
 * suite has no jsdom/DOM testing library to drive a real keydown.
 */
export function nextRovingIndex(currentIndex: number, key: string, length: number): number {
  const delta = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  return (currentIndex + delta + length) % length;
}

type SwitchOption = {
  value: string;
  label: string;
  Icon: LucideIcon;
};

type SwitchGroup = {
  id: SwitchId;
  key: string;
  groupLabel: string;
  options: SwitchOption[];
};

/**
 * The single local table every group's ARIA wiring, roving tabindex and
 * option list is driven from (07-PLAN action text) — a future fourth switch
 * is a data change here, not new markup or a new keyboard handler.
 */
const SWITCH_GROUPS: SwitchGroup[] = [
  {
    id: "categoryLayout",
    key: LAYOUT_SETTING_KEYS.categoryLayout,
    groupLabel: "Category layout",
    options: [
      { value: "grid-3", label: "3 columns", Icon: LayoutGrid },
      { value: "grid-2", label: "2 columns", Icon: Columns2 },
      { value: "list", label: "List", Icon: LayoutList },
    ],
  },
  {
    id: "homeHero",
    key: LAYOUT_SETTING_KEYS.homeHero,
    groupLabel: "Home hero",
    options: [
      { value: "minimal", label: "Minimal", Icon: TextAlignCenter },
      { value: "split", label: "Split", Icon: SquareSplitHorizontal },
      { value: "full-bleed", label: "Full-bleed", Icon: GalleryHorizontal },
    ],
  },
  {
    id: "productGallery",
    key: LAYOUT_SETTING_KEYS.productGallery,
    groupLabel: "Product gallery",
    options: [
      { value: "left", label: "Gallery left", Icon: PanelLeft },
      { value: "top", label: "Gallery top", Icon: PanelTop },
    ],
  },
];

export type LayoutSwitchesContentProps = {
  status: "loading" | "loaded" | "error";
  saved: LayoutSelections | null;
  pending: Partial<LayoutSelections>;
  saving: boolean;
  onSelect: (id: SwitchId, value: string) => void;
  onGroupKeyDown: (id: SwitchId, event: KeyboardEvent<HTMLDivElement>) => void;
  onSave: () => void;
};

/**
 * Pure, props-driven view: no state, no effects, no fetch. Exported (and
 * consumed by the stateful LayoutSwitches wrapper below) so tests can
 * render real DOM output via react-dom/server's renderToStaticMarkup and
 * assert on actual behavior, mirroring ThemePresetGridContent's split.
 */
export function LayoutSwitchesContent({
  status,
  saved,
  pending,
  saving,
  onSelect,
  onGroupKeyDown,
  onSave,
}: LayoutSwitchesContentProps) {
  const isDirty = SWITCH_GROUPS.some(
    (group) => pending[group.id] !== undefined && pending[group.id] !== saved?.[group.id],
  );
  const saveDisabled = status !== "loaded" || saving || !isDirty;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-white">Layout</h2>
        <p className="text-sm text-gray-400">
          Change the structure of the category grid, home hero, and product gallery —
          independent of the active theme.
        </p>
      </div>

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

      <div className="space-y-6">
        {SWITCH_GROUPS.map((group) => {
          const currentValue = pending[group.id] ?? saved?.[group.id] ?? DEFAULT_LAYOUTS[group.id];

          return (
            <div key={group.id}>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">{group.groupLabel}</h3>
              <div
                role="radiogroup"
                aria-label={group.groupLabel}
                className="flex flex-wrap gap-2"
                onKeyDown={(event) => onGroupKeyDown(group.id, event)}
              >
                {group.options.map((option) => {
                  const isSelected = currentValue === option.value;
                  const Icon = option.Icon;

                  return (
                    <Card
                      key={option.value}
                      id={`layout-option-${group.id}-${option.value}`}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={option.label}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => onSelect(group.id, option.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(group.id, option.value);
                        }
                      }}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 outline-none transition-colors ${
                        isSelected
                          ? "border-orange-500 bg-orange-600/10 text-white font-semibold ring-2 ring-orange-500"
                          : "border-neutral-700 bg-neutral-800 text-gray-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm">{option.label}</span>
                    </Card>
                  );
                })}
              </div>
            </div>
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
        {saving ? "Saving…" : "Save Layout"}
      </Button>
    </div>
  );
}

export function LayoutSwitches() {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [saved, setSaved] = useState<LayoutSelections | null>(null);
  const [pending, setPending] = useState<Partial<LayoutSelections>>({});
  const [saving, setSaving] = useState(false);

  // This island's own fetch, independent of ThemePresetGrid's fetch of the
  // same category — an accepted, known duplicate round trip that keeps the
  // two islands decoupled (D-12, RESEARCH open question 2).
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/settings?category=${APPEARANCE_SETTINGS_CATEGORY}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings");
        const body = (await response.json()) as SettingsResponse;
        if (cancelled) return;
        setSaved(extractLayoutSelections(body.settings));
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectOption(id: SwitchId, value: string) {
    setPending((prev) => ({ ...prev, [id]: value }));
  }

  function handleGroupKeyDown(id: SwitchId, event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const group = SWITCH_GROUPS.find((candidate) => candidate.id === id);
    if (!group) return;
    const currentValue = pending[id] ?? saved?.[id] ?? DEFAULT_LAYOUTS[id];
    const currentIndex = Math.max(
      0,
      group.options.findIndex((option) => option.value === currentValue),
    );
    const nextIndex = nextRovingIndex(currentIndex, event.key, group.options.length);
    const next = group.options[nextIndex];
    if (!next) return;
    selectOption(id, next.value);
    document.getElementById(`layout-option-${id}-${next.value}`)?.focus();
  }

  async function save() {
    // Only the groups the admin actually touched go in the request — not all
    // three unconditionally. Bundling untouched groups' saved.[group.id]
    // fallback into every save (07-REVIEW WR-01) meant one admin's save
    // could silently revert another admin's concurrent change to a field
    // this session never touched or saw change; the settings endpoint is
    // last-write-wins per-key, so only sending changed keys removes that
    // exposure entirely, matching ThemePresetGrid's own single-key POST.
    const dirtyGroups = SWITCH_GROUPS.filter(
      (group) => pending[group.id] !== undefined && pending[group.id] !== saved?.[group.id],
    );
    if (dirtyGroups.length === 0) return;

    setSaving(true);
    try {
      const updates = dirtyGroups.map((group) => ({
        key: group.key,
        value: pending[group.id]!,
        category: APPEARANCE_SETTINGS_CATEGORY,
        data_type: "string",
      }));

      // Re-check each pending value against its own enum before posting — a
      // cheap first line of defense; getLayoutSettings()'s own allow-list at
      // read time is the authoritative gate (T-07-14).
      const allValid = updates.every((update) => {
        const group = SWITCH_GROUPS.find((candidate) => candidate.key === update.key);
        return group ? group.options.some((option) => option.value === update.value) : false;
      });
      if (!allValid) throw new Error("Invalid layout selection");

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error("Save failed");

      // The endpoint's response body only echoes back the keys THIS request
      // sent (its own inArray(admin_settings.key, updatedKeys) read) — so a
      // partial save's response can't be fed straight into
      // extractLayoutSelections and used to replace all three fields, which
      // would fall the two untouched groups back to their defaults. Merge
      // the confirmed value for each dirty group into the existing saved
      // state instead, leaving every untouched group exactly as it was.
      const body = (await response.json()) as SettingsResponse;
      const confirmed = extractLayoutSelections(body.settings);
      const dirtyIds = new Set(dirtyGroups.map((group) => group.id));
      setSaved((previous) => {
        const base = previous ?? DEFAULT_LAYOUTS;
        return {
          categoryLayout: dirtyIds.has("categoryLayout")
            ? confirmed.categoryLayout
            : base.categoryLayout,
          homeHero: dirtyIds.has("homeHero") ? confirmed.homeHero : base.homeHero,
          productGallery: dirtyIds.has("productGallery")
            ? confirmed.productGallery
            : base.productGallery,
        };
      });
      setPending((previous) => {
        const next = { ...previous };
        for (const id of dirtyIds) {
          delete next[id];
        }
        return next;
      });
      toast.success("Layout saved.");
    } catch {
      toast.error("Couldn't save your layout changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <LayoutSwitchesContent
      status={status}
      saved={saved}
      pending={pending}
      saving={saving}
      onSelect={selectOption}
      onGroupKeyDown={handleGroupKeyDown}
      onSave={() => void save()}
    />
  );
}
