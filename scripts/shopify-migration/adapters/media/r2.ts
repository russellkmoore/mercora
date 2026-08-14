import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
  type PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { WranglerTarget } from "../../lib/wrangler-target.js";
import type { MediaContentType } from "./security.js";

export const IMMUTABLE_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const MEDIA_IMPORTER_VERSION = "mercora-shopify-migration-v1";

const METADATA_IMPORTER = "mercora-importer";
const METADATA_SOURCE_FINGERPRINT = "mercora-source-sha256";
const METADATA_CONTENT_SHA256 = "mercora-content-sha256";
const METADATA_BYTE_LENGTH = "mercora-byte-length";

export interface ExpectedMediaObject {
  contentType: MediaContentType;
  cacheControl: string;
  byteLength: number;
  sha256: string;
  sha256Base64: string;
  sourceFingerprint: string;
}

/** Metadata read from storage. Optional fields are never assumed to be trustworthy. */
export interface StoredMediaObject {
  contentType?: string;
  cacheControl?: string;
  byteLength: number;
  sha256?: string;
  importer?: string;
  sourceFingerprint?: string;
  importerContentSha256?: string;
  importerByteLength?: string;
}

export interface MediaObjectStore {
  inspect(bucketName: string, objectKey: string): Promise<StoredMediaObject | null>;
  put(
    bucketName: string,
    objectKey: string,
    bytes: Uint8Array,
    options: ExpectedMediaObject & { overwrite: boolean },
  ): Promise<"written" | "exists">;
}

export function storedMediaMatchesExpected(
  stored: StoredMediaObject | null,
  expected: ExpectedMediaObject,
): boolean {
  return stored !== null &&
    stored.contentType === expected.contentType &&
    stored.cacheControl === expected.cacheControl &&
    stored.byteLength === expected.byteLength &&
    stored.sha256 === expected.sha256 &&
    stored.importer === MEDIA_IMPORTER_VERSION &&
    stored.sourceFingerprint === expected.sourceFingerprint &&
    stored.importerContentSha256 === expected.sha256 &&
    stored.importerByteLength === String(expected.byteLength);
}

function customMetadata(expected: ExpectedMediaObject): Record<string, string> {
  return {
    [METADATA_IMPORTER]: MEDIA_IMPORTER_VERSION,
    [METADATA_SOURCE_FINGERPRINT]: expected.sourceFingerprint,
    [METADATA_CONTENT_SHA256]: expected.sha256,
    [METADATA_BYTE_LENGTH]: String(expected.byteLength),
  };
}

function bytesToHex(value: ArrayBuffer | Uint8Array): string {
  return Array.from(value instanceof Uint8Array ? value : new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("Media checksum is invalid");
  return Uint8Array.from(value.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
}

function base64ToHex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.byteLength === 32 ? bytesToHex(decoded) : undefined;
  } catch {
    return undefined;
  }
}

function metadataValue(metadata: Record<string, string> | undefined, key: string): string | undefined {
  if (!metadata) return undefined;
  const exact = metadata[key];
  if (exact !== undefined) return exact;
  const entry = Object.entries(metadata).find(([candidate]) => candidate.toLowerCase() === key);
  return entry?.[1];
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

/** Atomic Workers-binding adapter; failed If-None-Match returns exists instead of overwriting. */
export class R2BindingMediaStore implements MediaObjectStore {
  constructor(private readonly bucketName: string, private readonly bucket: R2Bucket) {}

  private assertBucket(bucketName: string): void {
    if (bucketName !== this.bucketName) throw new Error("Resolved MEDIA bucket does not match the bound R2 adapter");
  }

  async inspect(bucketName: string, objectKey: string): Promise<StoredMediaObject | null> {
    this.assertBucket(bucketName);
    safeObjectPath(bucketName, objectKey);
    const object = await this.bucket.head(objectKey);
    if (!object) return null;
    return {
      contentType: object.httpMetadata?.contentType,
      cacheControl: object.httpMetadata?.cacheControl,
      byteLength: object.size,
      sha256: object.checksums.sha256 ? bytesToHex(object.checksums.sha256) : undefined,
      importer: object.customMetadata?.[METADATA_IMPORTER],
      sourceFingerprint: object.customMetadata?.[METADATA_SOURCE_FINGERPRINT],
      importerContentSha256: object.customMetadata?.[METADATA_CONTENT_SHA256],
      importerByteLength: object.customMetadata?.[METADATA_BYTE_LENGTH],
    };
  }

  async put(
    bucketName: string,
    objectKey: string,
    bytes: Uint8Array,
    options: ExpectedMediaObject & { overwrite: boolean },
  ): Promise<"written" | "exists"> {
    this.assertBucket(bucketName);
    safeObjectPath(bucketName, objectKey);
    const body = new Uint8Array(bytes);
    const result = await this.bucket.put(objectKey, body, {
      ...(options.overwrite ? {} : { onlyIf: { etagDoesNotMatch: "*" } }),
      httpMetadata: { contentType: options.contentType, cacheControl: options.cacheControl },
      customMetadata: customMetadata(options),
      sha256: hexToBytes(options.sha256),
    });
    return result === null ? "exists" : "written";
  }
}

export interface S3CommandSender {
  send(command: HeadObjectCommand): Promise<HeadObjectCommandOutput>;
  send(command: PutObjectCommand): Promise<PutObjectCommandOutput>;
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  if (!metadata || typeof metadata !== "object" || !("httpStatusCode" in metadata)) return undefined;
  return typeof metadata.httpStatusCode === "number" ? metadata.httpStatusCode : undefined;
}

function errorName(error: unknown): string | undefined {
  return error && typeof error === "object" && "name" in error && typeof error.name === "string" ? error.name : undefined;
}

function isConditionalWriteConflict(error: unknown): boolean {
  const status = errorStatus(error);
  const name = errorName(error);
  return status === 409 || status === 412 || name === "ConditionalRequestConflict" || name === "PreconditionFailed";
}

/** Node operator adapter for R2's S3-compatible API. The bucket must come from canonical Wrangler resolution. */
export class R2S3MediaStore implements MediaObjectStore {
  constructor(private readonly bucketName: string, private readonly client: S3CommandSender) {
    safeObjectPath(bucketName, "pages/validation/1.jpg");
  }

  private assertBucket(bucketName: string): void {
    if (bucketName !== this.bucketName) throw new Error("Resolved MEDIA bucket does not match the S3 R2 adapter");
  }

  async inspect(bucketName: string, objectKey: string): Promise<StoredMediaObject | null> {
    this.assertBucket(bucketName);
    safeObjectPath(bucketName, objectKey);
    let response: HeadObjectCommandOutput;
    try {
      response = await this.client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ChecksumMode: "ENABLED",
      }));
    } catch (error) {
      const status = errorStatus(error);
      const name = errorName(error);
      if (status === 404 || name === "NotFound" || name === "NoSuchKey") return null;
      throw new Error("R2 object inspection failed");
    }
    return {
      contentType: response.ContentType,
      cacheControl: response.CacheControl,
      byteLength: response.ContentLength ?? -1,
      sha256: base64ToHex(response.ChecksumSHA256),
      importer: metadataValue(response.Metadata, METADATA_IMPORTER),
      sourceFingerprint: metadataValue(response.Metadata, METADATA_SOURCE_FINGERPRINT),
      importerContentSha256: metadataValue(response.Metadata, METADATA_CONTENT_SHA256),
      importerByteLength: metadataValue(response.Metadata, METADATA_BYTE_LENGTH),
    };
  }

  async put(
    bucketName: string,
    objectKey: string,
    bytes: Uint8Array,
    options: ExpectedMediaObject & { overwrite: boolean },
  ): Promise<"written" | "exists"> {
    this.assertBucket(bucketName);
    safeObjectPath(bucketName, objectKey);
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: new Uint8Array(bytes),
        ContentLength: bytes.byteLength,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
        ChecksumSHA256: options.sha256Base64,
        Metadata: customMetadata(options),
        ...(options.overwrite ? {} : { IfNoneMatch: "*" }),
      }));
      return "written";
    } catch (error) {
      if (!options.overwrite && isConditionalWriteConflict(error)) return "exists";
      throw new Error("R2 object write failed");
    }
  }
}

export interface R2S3Credentials {
  bucketName: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Builds the official S3 client without placing credentials in argv, object metadata, or errors. */
export function createR2S3MediaStore(options: R2S3Credentials): R2S3MediaStore {
  if (!/^[a-f0-9]{32}$/iu.test(options.accountId)) throw new Error("Cloudflare account ID is invalid");
  if (!options.accessKeyId || options.accessKeyId.length > 512 || /[\0\r\n]/u.test(options.accessKeyId)) {
    throw new Error("R2 access key ID is invalid");
  }
  if (!options.secretAccessKey || options.secretAccessKey.length > 2_048 || /[\0\r\n]/u.test(options.secretAccessKey)) {
    throw new Error("R2 secret access key is invalid");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${options.accountId.toLowerCase()}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
  });
  return new R2S3MediaStore(options.bucketName, client);
}
