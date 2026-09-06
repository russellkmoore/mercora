import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Shared reader for pre-extraction parity baselines (D-06).
 *
 * A parity baseline is the test's oracle, not a build artefact: it proves a
 * refactor changed nothing observable. The dangerous default this helper
 * removes is a suite that silently *writes* a missing baseline the first
 * time it runs — a baseline that regenerates itself proves nothing, because
 * a bug introduced before the first run would be captured as "correct"
 * forever. Instead, a missing baseline is a loud failure by default, and
 * writing one is only ever a deliberate, visible act: set
 * `UPDATE_SNAPSHOTS=1` and supply the freshly rendered content to record.
 *
 * `existsSync` is the presence check (not a read-and-catch), so a baseline
 * file that exists but is empty reads as present — never "missing".
 */
const UPDATE_SNAPSHOTS_FLAG = "UPDATE_SNAPSHOTS";

export function readParitySnapshot(relativePath: string, actual?: string): string {
  const absolutePath = resolve(process.cwd(), relativePath);
  const optedIn = process.env[UPDATE_SNAPSHOTS_FLAG] === "1";

  if (existsSync(absolutePath)) {
    return readFileSync(absolutePath, "utf8");
  }

  if (!optedIn) {
    throw new Error(
      `Parity baseline missing: ${absolutePath}\n` +
        `A parity baseline is this test's oracle and is never generated implicitly. ` +
        `To record it deliberately, re-run with ${UPDATE_SNAPSHOTS_FLAG}=1 set.`,
    );
  }

  if (actual === undefined) {
    throw new Error(
      `Refusing to write an empty parity baseline: ${absolutePath}\n` +
        `${UPDATE_SNAPSHOTS_FLAG}=1 was set but no content was supplied to record.`,
    );
  }

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, actual, "utf8");
  return actual;
}
