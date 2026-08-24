import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_MAX_PRIVATE_FILE_BYTES = 10 * 1024 * 1024;

export interface AtomicFileOperations {
  open(path: string, flags: string, mode: number): number;
  write(fd: number, buffer: Uint8Array, offset: number, length: number): number;
  fsync(fd: number): void;
  close(fd: number): void;
  rename(from: string, to: string): void;
  fsyncDirectory(path: string): void;
  unlink(path: string): void;
}

function isUnsupportedDirectorySync(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return false;
  return ["EINVAL", "ENOTSUP", "ENOSYS"].includes(error.code) ||
    process.platform === "win32" && ["EACCES", "EISDIR", "EPERM"].includes(error.code);
}

function fsyncDirectory(path: string): void {
  let directoryFd: number | undefined;
  try {
    directoryFd = openSync(path, "r");
    fsyncSync(directoryFd);
  } catch (error) {
    if (!isUnsupportedDirectorySync(error)) throw error;
  } finally {
    if (directoryFd !== undefined) closeSync(directoryFd);
  }
}

const nodeOperations: AtomicFileOperations = {
  open: openSync,
  write: writeSync,
  fsync: fsyncSync,
  close: closeSync,
  rename: renameSync,
  fsyncDirectory,
  unlink: unlinkSync,
};

function assertNoSymlinkTraversal(root: string, candidate: string): void {
  const child = relative(root, candidate);
  if (child.startsWith("..") || isAbsolute(child)) throw new Error("Artifact path escapes the configured output root");
  let cursor = root;
  for (const part of child.split(sep)) {
    cursor = resolve(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error("Artifact path may not traverse a symbolic link");
    }
  }
}

/** Resolve a private artifact below an explicit root without following symlink components. */
export function resolvePrivateArtifactPath(root: string, requestedPath: string): string {
  if (!requestedPath || isAbsolute(requestedPath) || requestedPath.includes("\0")) {
    throw new Error("Artifact path must be a relative path");
  }
  mkdirSync(resolve(root), { recursive: true, mode: 0o700 });
  const absoluteRoot = realpathSync(root);
  const candidate = resolve(absoluteRoot, requestedPath);
  assertNoSymlinkTraversal(absoluteRoot, candidate);
  mkdirSync(dirname(candidate), { recursive: true, mode: 0o700 });
  assertNoSymlinkTraversal(absoluteRoot, candidate);
  return candidate;
}

/**
 * Replace a bounded private file atomically. The old valid file remains intact
 * unless a fully written, fsynced 0600 temporary file is ready to rename.
 */
export function atomicWritePrivateFile(
  path: string,
  content: string | Uint8Array,
  options: {
    maxBytes?: number;
    operations?: Partial<AtomicFileOperations>;
  } = {},
): void {
  if (!isAbsolute(path) || path.includes("\0")) throw new Error("Private artifact destination must be absolute");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_PRIVATE_FILE_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 100 * 1024 * 1024) {
    throw new Error("Private artifact byte limit is invalid");
  }
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : new Uint8Array(content);
  if (bytes.byteLength > maxBytes) throw new Error(`Private artifact exceeds the ${maxBytes}-byte limit`);
  const operations = { ...nodeOperations, ...options.operations };
  const tempPath = resolve(dirname(path), `.${randomBytes(16).toString("hex")}.tmp`);
  let fd: number | undefined;
  let renamed = false;
  try {
    fd = operations.open(tempPath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = operations.write(fd, bytes, offset, bytes.byteLength - offset);
      if (!Number.isSafeInteger(written) || written < 1 || written > bytes.byteLength - offset) {
        throw new Error("Private artifact write did not make safe progress");
      }
      offset += written;
    }
    operations.fsync(fd);
    operations.close(fd);
    fd = undefined;
    operations.rename(tempPath, path);
    renamed = true;
    operations.fsyncDirectory(dirname(path));
  } finally {
    if (fd !== undefined) {
      try { operations.close(fd); } catch { /* preserve the original failure */ }
    }
    if (!renamed) {
      try { operations.unlink(tempPath); } catch { /* an absent temp is already clean */ }
    }
  }
}
