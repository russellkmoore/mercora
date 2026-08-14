import { createHash } from "node:crypto";
import type { ExecutionPlan } from "../../lib/config.js";
import { parseWranglerJsonc, resolveMediaTarget } from "../../lib/wrangler-target.js";
import type { MediaRewrite } from "../../transformers/_shared.js";
import { downloadVerifiedMedia, validateMediaPlan, type MediaDownloadOptions } from "./security.js";
import {
  REVALIDATING_MEDIA_CACHE_CONTROL,
  storedMediaMatchesExpected,
  type ExpectedMediaObject,
  type MediaObjectStore,
} from "./r2.js";

export interface PlannedMediaImportResult {
  objectKey: string;
  publicPath: string;
  contentType: MediaRewrite["contentType"];
  status: "planned";
  byteLength: null;
  sha256: null;
}

export interface AppliedMediaImportResult {
  objectKey: string;
  publicPath: string;
  contentType: MediaRewrite["contentType"];
  status: "written" | "verified-existing";
  byteLength: number;
  sha256: string;
}

export type MediaImportResult = PlannedMediaImportResult | AppliedMediaImportResult;

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

export function fingerprintMediaSource(sourceUrl: string): string {
  return createHash("sha256").update(sourceUrl, "utf8").digest("hex");
}

function describeMedia(plan: MediaRewrite, bytes: Uint8Array): ExpectedMediaObject {
  const hash = createHash("sha256").update(bytes);
  return {
    contentType: plan.contentType,
    cacheControl: REVALIDATING_MEDIA_CACHE_CONTROL,
    byteLength: bytes.byteLength,
    sha256: hash.copy().digest("hex"),
    sha256Base64: hash.digest("base64"),
    sourceFingerprint: fingerprintMediaSource(plan.sourceUrl),
  };
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
    return plans.map((plan) => ({
      objectKey: plan.objectKey,
      publicPath: plan.publicPath,
      contentType: plan.contentType,
      status: "planned" as const,
      byteLength: null,
      sha256: null,
    }));
  }

  const results: MediaImportResult[] = [];
  for (const plan of plans) {
    const media = await downloadVerifiedMedia(plan, {
      ...options.download,
      allowedHosts: options.allowedHosts,
    });
    const descriptor = describeMedia(plan, media.bytes);
    const status = await options.store.put(target.bucketName, media.objectKey, media.bytes, {
      ...descriptor,
      overwrite: options.execution.overwrite,
    });
    if (status === "exists") {
      const stored = await options.store.inspect(target.bucketName, media.objectKey);
      if (!storedMediaMatchesExpected(stored, descriptor)) {
        throw new Error("Existing media object does not match the verified import; explicit overwrite review is required");
      }
    }
    results.push({
      objectKey: media.objectKey,
      publicPath: media.publicPath,
      contentType: media.contentType,
      status: status === "written" ? "written" : "verified-existing",
      byteLength: media.bytes.byteLength,
      sha256: descriptor.sha256,
    });
  }
  return results;
}

export { downloadVerifiedMedia, validateMediaPlan } from "./security.js";
export {
  createR2S3MediaStore,
  R2BindingMediaStore,
  R2S3MediaStore,
  wranglerR2GetArguments,
  wranglerR2PutArguments,
} from "./r2.js";
export type {
  ExpectedMediaObject,
  MediaObjectStore,
  R2S3Credentials,
  StoredMediaObject,
} from "./r2.js";
