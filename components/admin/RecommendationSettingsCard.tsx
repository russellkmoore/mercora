"use client";

import { useEffect, useState } from "react";
import { Bot, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { RecommendationSettings } from "@/lib/recommendations/types";

const defaults: RecommendationSettings = {
  strategy: "deterministic",
  personalize: true,
  limit: 3,
  excludeOwned: true,
};

export function RecommendationSettingsCard() {
  const [settings, setSettings] = useState(defaults);
  const [busy, setBusy] = useState<"load" | "save" | "rebuild" | null>("load");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/recommendations/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings");
        const body = (await response.json()) as { settings: RecommendationSettings };
        setSettings(body.settings);
      })
      .catch(() => setMessage("Recommendation settings could not be loaded."))
      .finally(() => setBusy(null));
  }, []);

  async function save() {
    setBusy("save");
    setMessage("");
    try {
      const response = await fetch("/api/admin/recommendations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Save failed");
      setMessage("Recommendation settings saved.");
    } catch {
      setMessage("Recommendation settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function rebuild() {
    setBusy("rebuild");
    setMessage("");
    try {
      const response = await fetch("/api/admin/recommendations/rebuild", { method: "POST" });
      const body = (await response.json()) as {
        error?: string;
        rowsWritten?: number;
        productsProcessed?: number;
        productsDeferred?: number;
        errors?: unknown[];
      };
      if (!response.ok) throw new Error(body.error || "Rebuild failed");
      const failures = body.errors?.length ?? 0;
      setMessage(
        `Rebuild wrote ${body.rowsWritten ?? 0} rows for ${body.productsProcessed ?? 0} products` +
          (failures ? ` with ${failures} errors` : "") +
          ((body.productsDeferred ?? 0) > 0 ? `; ${body.productsDeferred} products deferred.` : "."),
      );
    } catch {
      setMessage("Recommendations could not be rebuilt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="bg-neutral-800 border-neutral-700 p-6">
      <div className="mb-4 flex items-center space-x-3">
        <Bot className="h-5 w-5 text-orange-400" />
        <h3 className="text-lg font-semibold text-white">Product Recommendations</h3>
      </div>
      <div className="space-y-4">
        <label className="block text-sm text-gray-300">
          Strategy
          <select
            value={settings.strategy}
            disabled={busy !== null}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                strategy: event.target.value === "ai_batch" ? "ai_batch" : "deterministic",
              }))
            }
            className="mt-2 w-full rounded-md border border-neutral-600 bg-neutral-700 px-3 py-2 text-white"
          >
            <option value="deterministic">Deterministic</option>
            <option value="ai_batch">AI batch</option>
          </select>
        </label>
        <label className="block text-sm text-gray-300">
          Products shown (1–6)
          <input
            type="number"
            min={1}
            max={6}
            value={settings.limit}
            disabled={busy !== null}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                limit: Math.max(1, Math.min(6, Number(event.target.value) || 1)),
              }))
            }
            className="mt-2 w-full rounded-md border border-neutral-600 bg-neutral-700 px-3 py-2 text-white"
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Personalize from order history</span>
          <Switch
            checked={settings.personalize}
            disabled={busy !== null}
            onCheckedChange={(personalize) =>
              setSettings((current) => ({ ...current, personalize }))
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Exclude products already owned</span>
          <Switch
            checked={settings.excludeOwned}
            disabled={busy !== null}
            onCheckedChange={(excludeOwned) =>
              setSettings((current) => ({ ...current, excludeOwned }))
            }
          />
        </div>
        {message && <p className="text-xs text-gray-400" role="status">{message}</p>}
        <div className="flex flex-wrap gap-3 border-t border-neutral-700 pt-4">
          <Button onClick={save} disabled={busy !== null} className="bg-orange-600 hover:bg-orange-700">
            {busy === "save" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button onClick={rebuild} disabled={busy !== null} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${busy === "rebuild" ? "animate-spin" : ""}`} />
            Rebuild now
          </Button>
        </div>
      </div>
    </Card>
  );
}
