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

/** Fail only on unacknowledged contractions; report the rest for the log. */
export function summarize(reports) {
  return {
    blocked: reports.filter(({ status }) => status === "contract"),
    acknowledged: reports.filter(({ status }) => status === "acknowledged"),
    expand: reports.filter(({ status }) => status === "expand"),
  };
}
