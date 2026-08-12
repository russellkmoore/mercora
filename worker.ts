/**
 * === Custom Cloudflare Worker Entry ===
 *
 * Wraps the OpenNext-generated fetch handler (which serves the Next.js app)
 * and adds a scheduled (cron) handler. The cron regenerates the Admin BI
 * dashboard cache in D1 by calling the same generator the manual "Refresh"
 * button uses (`regenerateAnalytics`), so both paths produce identical output.
 *
 * Cron cadence is configured in wrangler.jsonc (`triggers.crons`).
 *
 * The fetch handler is unchanged — this only adds a `scheduled` export on top
 * of the generated handler, so normal request behavior is unaffected.
 */

// @ts-ignore `.open-next/worker.js` is generated at build time by opennextjs-cloudflare
import { default as handler } from "./.open-next/worker.js";
import { regenerateAnalytics } from "@/lib/analytics/generate-insights";
import { drainOrderEffects } from "@/lib/services/order-effects";
import { drainInventoryAdjustments } from "@/lib/services/inventory-adjustments";
import { runRecommendationCron } from "@/lib/recommendations/cron";
import { recordTelemetry } from "@/lib/observability/telemetry";

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ) {
    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(
        Promise.all([
          drainOrderEffects({ database: env.DB, limit: 25 }),
          drainInventoryAdjustments({ database: env.DB, limit: 25 }),
        ])
          .then(([effects, inventory]) =>
            console.log("[cron] recovery queues drained", { effects, inventory })
          )
          .catch((error) => recordTelemetry("cron.recovery_failed", {
            operation: "process", outcome: "failed", provider: "d1",
            retryable: true, trigger: "recovery",
          }, error))
      );
      return;
    }

    if (controller.cron === "15 8 * * *") {
      ctx.waitUntil(runRecommendationCron(env));
      return;
    }

    if (controller.cron !== "0 */6 * * *") {
      console.warn("[cron] ignoring unknown scheduled trigger", controller.cron);
      return;
    }

    ctx.waitUntil(
      regenerateAnalytics(env)
        .then(() => console.log("[cron] analytics cache regenerated"))
        .catch((error) => recordTelemetry("cron.analytics_failed", {
          operation: "rebuild", outcome: "failed", provider: "d1",
          retryable: true, trigger: "scheduled",
        }, error))
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
