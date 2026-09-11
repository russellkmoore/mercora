/** Pure, testable helpers for classifying migration safety. */

/**
 * A deploy that applies migrations before uploading the Worker leaves the
 * previous code running against the new schema for the duration of the upload.
 * Additive ("expand") statements are invisible to that older code. Statements
 * that remove or narrow an existing object are not: they break the running
 * Worker before its replacement exists.
 *
 * Contract migrations are therefore not forbidden, only rejected until an
 * operator states that the reading code already shipped in an earlier release.
 */

export const ACKNOWLEDGEMENT_PREFIX = "-- migration-safety: acknowledged";

const CONTRACT_PATTERNS = [
  { label: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/i },
  { label: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  { label: "DROP INDEX", pattern: /\bDROP\s+INDEX\b/i },
  { label: "DROP TRIGGER", pattern: /\bDROP\s+TRIGGER\b/i },
  { label: "RENAME", pattern: /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\b/i },
  { label: "DELETE FROM", pattern: /\bDELETE\s+FROM\b/i },
];

/**
 * Remove comments so a pattern named in prose cannot fail a migration, and so
 * the acknowledgement line itself is never scanned as a statement.
 *
 * Mirrors the string-awareness of stripJsonComments: a `--` inside a string
 * literal is data, not a comment.
 */
export function stripSqlComments(text) {
  let output = "";
  let inString = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        output += current;
      }
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      output += current;
      // SQLite escapes a quote by doubling it; both halves stay in the string.
      if (current === "'") inString = next === "'" ? (index += 1, true) : false;
      continue;
    }
    if (current === "'") {
      inString = true;
      output += current;
    } else if (current === "-" && next === "-") {
      lineComment = true;
      index += 1;
    } else if (current === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else {
      output += current;
    }
  }

  return output;
}

/** An acknowledgement must carry a reason; a bare marker is not a decision. */
export function acknowledgement(text) {
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith(ACKNOWLEDGEMENT_PREFIX)) continue;
    const reason = trimmed.slice(ACKNOWLEDGEMENT_PREFIX.length).trim();
    if (reason) return reason;
  }
  return null;
}

/** Classify one migration's contents. */
export function inspectMigration(file, text) {
  const statements = stripSqlComments(text);
  const contractions = CONTRACT_PATTERNS
    .filter(({ pattern }) => pattern.test(statements))
    .map(({ label }) => label);

  if (!contractions.length) return { file, status: "expand" };

  const reason = acknowledgement(text);
  return reason
    ? { file, status: "acknowledged", contractions, reason }
    : { file, status: "contract", contractions };
}

/** Matches a migration filename's leading number, e.g. "0023" in "0023_foo.sql". */
const MIGRATION_NUMBER_RE = /^(\d+)_/;

/** The basename of a path, so a `migrations/` prefix never affects comparison. */
function basename(filePath) {
  const parts = String(filePath).split("/");
  return parts[parts.length - 1];
}

/** A filename's leading migration number, or null if it has none. */
function migrationNumber(filePath) {
  const match = MIGRATION_NUMBER_RE.exec(basename(filePath));
  return match ? match[1] : null;
}

/**
 * Reports a migration number reused by a file this change added.
 *
 * `applyD1Migrations` orders by filename, so a shared number is only a
 * problem when at least one side of the collision is new — a number two
 * already-applied files share, like this repository's two `0023` files, is
 * left alone on purpose (D-16). The rule fires whenever an added file's
 * number matches any other file's number, whether that other file is
 * pre-existing or itself newly added; it never fires for a collision between
 * two files that are both pre-existing.
 */
export function findDuplicateNumbers(addedFiles, allFiles) {
  const reports = [];

  for (const added of addedFiles) {
    const addedBase = basename(added);
    const number = migrationNumber(added);
    if (number === null) continue;

    const collidesWith = [];
    for (const other of allFiles) {
      const otherBase = basename(other);
      if (otherBase === addedBase) continue;
      if (migrationNumber(other) === number && !collidesWith.includes(otherBase)) {
        collidesWith.push(otherBase);
      }
    }

    if (collidesWith.length) {
      reports.push({ file: added, number, collidesWith });
    }
  }

  return reports;
}

/** Fail only on unacknowledged contractions; report the rest for the log. */
export function summarize(reports) {
  return {
    blocked: reports.filter(({ status }) => status === "contract"),
    acknowledged: reports.filter(({ status }) => status === "acknowledged"),
    expand: reports.filter(({ status }) => status === "expand"),
  };
}
