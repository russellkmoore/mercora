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
import { handleScheduled } from "@/lib/observability/scheduled";

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ) {
    handleScheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
