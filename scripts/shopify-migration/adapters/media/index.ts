import type { ExecutionPlan } from "../../lib/config.js";
import { parseWranglerJsonc, resolveMediaTarget } from "../../lib/wrangler-target.js";
import type { MediaRewrite } from "../../transformers/_shared.js";
import { downloadVerifiedMedia, validateMediaPlan, type MediaDownloadOptions } from "./security.js";
import { IMMUTABLE_MEDIA_CACHE_CONTROL, type MediaObjectStore } from "./r2.js";

export interface MediaImportResult {
  objectKey: string;
  status: "planned" | "written" | "exists";
  bytes: number;
}

export interface MediaImportOptions {
  execution: ExecutionPlan;
  wranglerConfigText: string;
  wranglerEnvironment?: string;
  allowedHosts: readonly string[];
  store: MediaObjectStore;
  download?: Omit<MediaDownloadOptions, "allowedHosts">;
}

function assertExecution(execution: ExecutionPlan): void {
  if (execution.dryRun === execution.apply) throw new Error("Migration execution must be exactly one of dry-run or apply");
  if (execution.target === "preview" && execution.apply && !execution.confirmedPreview) {
    throw new Error("Preview media writes require explicit preview confirmation");
  }
  if (execution.target === "production" && execution.apply && !execution.confirmedProduction) {
    throw new Error("Production media writes require explicit production confirmation");
  }
  if (execution.overwrite && !execution.confirmedOverwrite) {
    throw new Error("Media overwrite requires explicit overwrite confirmation");
  }
}

export async function importMediaPlans(
  plans: readonly MediaRewrite[],
  options: MediaImportOptions,
): Promise<MediaImportResult[]> {
  assertExecution(options.execution);
  const target = resolveMediaTarget(parseWranglerJsonc(options.wranglerConfigText), {
    target: options.execution.target,
    environment: options.wranglerEnvironment,
  });
  const objectKeys = new Set<string>();
  for (const plan of plans) {
    validateMediaPlan(plan, options.allowedHosts);
    if (objectKeys.has(plan.objectKey)) throw new Error(`Duplicate media object key in import plan: ${plan.objectKey}`);
    objectKeys.add(plan.objectKey);
  }

  if (options.execution.dryRun) {
    return plans.map((plan) => ({ objectKey: plan.objectKey, status: "planned", bytes: 0 }));
  }

  const results: MediaImportResult[] = [];
  for (const plan of plans) {
    if (!options.execution.overwrite && await options.store.head(target.bucketName, plan.objectKey)) {
      results.push({ objectKey: plan.objectKey, status: "exists", bytes: 0 });
      continue;
    }
    const media = await downloadVerifiedMedia(plan, {
      ...options.download,
      allowedHosts: options.allowedHosts,
    });
    const status = await options.store.put(target.bucketName, media.objectKey, media.bytes, {
      contentType: media.contentType,
      cacheControl: IMMUTABLE_MEDIA_CACHE_CONTROL,
      overwrite: options.execution.overwrite,
    });
    results.push({ objectKey: media.objectKey, status, bytes: status === "written" ? media.bytes.byteLength : 0 });
  }
  return results;
}

export { downloadVerifiedMedia, validateMediaPlan } from "./security.js";
export { R2BindingMediaStore, wranglerR2GetArguments, wranglerR2PutArguments } from "./r2.js";
