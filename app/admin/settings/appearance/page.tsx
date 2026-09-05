/**
 * === Admin Appearance Page ===
 *
 * Lets an admin pick the storefront's active theme from the shipped preset
 * manifest. The page itself stays thin — title, subtitle, and the grid — the
 * interaction (pending selection, save, toast) lives entirely in the client
 * island below (THEME-03, D-13/D-14/D-15).
 */

import { ThemePresetGrid } from "@/components/admin/ThemePresetGrid";
import { LayoutSwitches } from "@/components/admin/LayoutSwitches";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "Appearance",
};

export default function AdminAppearancePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Appearance</h1>
        <p className="text-gray-400">
          Choose the storefront&apos;s look. Changes apply to the live site immediately
          after saving — no redeploy needed.
        </p>
      </div>

      <ThemePresetGrid />

      <Separator className="bg-neutral-800" />

      <LayoutSwitches />
    </div>
  );
}
