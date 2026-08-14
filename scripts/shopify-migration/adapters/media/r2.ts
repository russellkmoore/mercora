import type { WranglerTarget } from "../../lib/wrangler-target.js";
import type { MediaContentType } from "./security.js";

export const IMMUTABLE_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface MediaObjectStore {
  head(bucketName: string, objectKey: string): Promise<boolean>;
  put(
    bucketName: string,
    objectKey: string,
    bytes: Uint8Array,
    options: { contentType: MediaContentType; cacheControl: string; overwrite: boolean },
  ): Promise<"written" | "exists">;
}

function safeObjectPath(bucketName: string, objectKey: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{1,126}[a-z0-9]$/i.test(bucketName)) throw new Error("R2 bucket name is invalid");
  if (!/^(?:products|categories|blog|pages)\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\/(?:cover\/|inline\/)?[1-9][0-9]{0,5}\.(?:jpe?g|png|webp)$/i.test(objectKey)) {
    throw new Error("R2 object key is invalid");
  }
  return `${bucketName}/${objectKey}`;
}

function modeArguments(target: WranglerTarget): string[] {
  return target === "local" ? ["--local"] : ["--remote"];
}

function environmentArguments(environment?: string): string[] {
  if (!environment) return [];
  if (!/^[a-z][a-z0-9_-]{0,62}$/i.test(environment)) throw new Error("Wrangler environment is invalid");
  return ["--env", environment];
}

function configArgument(value: string): string {
  if (!value || value.startsWith("-") || value.length > 4_096 || /[\0\r\n]/u.test(value)) {
    throw new Error("Wrangler config path is invalid");
  }
  return value;
}

export function wranglerR2GetArguments(options: {
  bucketName: string;
  objectKey: string;
  target: WranglerTarget;
  environment?: string;
  configPath: string;
}): string[] {
  return [
    "r2", "object", "get", safeObjectPath(options.bucketName, options.objectKey), "--pipe",
    ...modeArguments(options.target), "--config", configArgument(options.configPath),
    ...environmentArguments(options.environment),
  ];
}

/** Wrangler has no conditional object-put flag, so this path is overwrite-only. */
export function wranglerR2PutArguments(options: {
  bucketName: string;
  objectKey: string;
  target: WranglerTarget;
  environment?: string;
  configPath: string;
  contentType: MediaContentType;
  overwriteConfirmed: boolean;
}): string[] {
  if (!options.overwriteConfirmed) {
    throw new Error("Wrangler R2 put cannot guarantee create-only writes; explicit overwrite confirmation is required");
  }
  return [
    "r2", "object", "put", safeObjectPath(options.bucketName, options.objectKey), "--pipe",
    "--content-type", options.contentType,
    "--cache-control", IMMUTABLE_MEDIA_CACHE_CONTROL,
    ...modeArguments(options.target), "--config", configArgument(options.configPath),
    ...environmentArguments(options.environment),
  ];
}

/** Atomic R2-binding adapter; failed If-None-Match returns null instead of overwriting. */
export class R2BindingMediaStore implements MediaObjectStore {
  constructor(private readonly bucketName: string, private readonly bucket: R2Bucket) {}

  private assertBucket(bucketName: string): void {
    if (bucketName !== this.bucketName) throw new Error("Resolved MEDIA bucket does not match the bound R2 adapter");
  }

  async head(bucketName: string, objectKey: string): Promise<boolean> {
    this.assertBucket(bucketName);
    safeObjectPath(bucketName, objectKey);
    return (await this.bucket.head(objectKey)) !== null;
  }

  async put(
    bucketName: string,
    objectKey: string,
    bytes: Uint8Array,
    options: { contentType: MediaContentType; cacheControl: string; overwrite: boolean },
  ): Promise<"written" | "exists"> {
    this.assertBucket(bucketName);
    safeObjectPath(bucketName, objectKey);
    const body = new Uint8Array(bytes);
    const result = await this.bucket.put(objectKey, body, {
      ...(options.overwrite ? {} : { onlyIf: { etagDoesNotMatch: "*" } }),
      httpMetadata: { contentType: options.contentType, cacheControl: options.cacheControl },
    });
    return result === null ? "exists" : "written";
  }
}
