export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: unknown;
}

export type LogSink = (record: StructuredLogRecord) => void;

const REDACTED = "[REDACTED]";
const numericField = /^(?:count|sourceCount|recordCount|transformed|written|inserted|migrated|skipped|errors|warnings|retries|attempt|page|pages|maxPages|maxRecords|durationMs|bytes)$/;
const booleanField = /^(?:dryRun|apply|overwrite|success|completed)$/;
const labelField = /^(?:entity|entityType|provider|stage|mode|sourceMode|target|operation|resource|status|errorClass)$/;
const containerField = /^(?:metrics|summary|execution|retry|pagination|result)$/;
const errorField = /^(?:error|exception)$/;
const safeLabel = /^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/;

function containsSecret(value: string, secrets: readonly string[]): boolean {
  return secrets.some((secret) => secret !== "" && value.includes(secret));
}

function redactValue(
  value: unknown,
  secrets: readonly string[],
  key: string,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (depth > 5) return REDACTED;
  if (value instanceof Error) {
    return { errorClass: safeLabel.test(value.name) ? value.name : "Error" };
  }
  if (numericField.test(key)) {
    return typeof value === "number" && Number.isFinite(value) ? value : REDACTED;
  }
  if (booleanField.test(key)) return typeof value === "boolean" ? value : REDACTED;
  if (labelField.test(key)) {
    return typeof value === "string" && safeLabel.test(value) && !containsSecret(value, secrets)
      ? value
      : REDACTED;
  }
  if (Array.isArray(value)) return REDACTED;
  if (value && typeof value === "object") {
    if (key && !containerField.test(key)) return REDACTED;
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    const output: Record<string, unknown> = {};
    let unknown = false;
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      if (
        numericField.test(childKey) ||
        booleanField.test(childKey) ||
        labelField.test(childKey) ||
        containerField.test(childKey) ||
        (errorField.test(childKey) && child instanceof Error)
      ) {
        output[childKey] = redactValue(child, secrets, childKey, seen, depth + 1);
      } else {
        unknown = true;
      }
    }
    if (unknown) output.redacted = REDACTED;
    seen.delete(value);
    return output;
  }
  return value === null ? null : REDACTED;
}

/**
 * Admit only operational metadata. Unknown keys and all record payloads are
 * redacted, so customer/order/provider values cannot cross the log boundary.
 */
export function redactForLog(value: unknown, secrets: readonly string[] = [], key = ""): unknown {
  return redactValue(value, secrets, key, new WeakSet<object>(), 0);
}

function consoleSink(record: StructuredLogRecord): void {
  const line = JSON.stringify(record);
  if (record.level === "error") console.error(line);
  else if (record.level === "warn") console.warn(line);
  else console.log(line);
}

export class MigrationLogger {
  constructor(
    private readonly sink: LogSink = consoleSink,
    private readonly secrets: readonly string[] = [],
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private emit(level: LogLevel, event: string, context?: unknown): void {
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(event)) throw new Error("Log event must be a stable machine-readable name");
    this.sink({
      timestamp: this.clock().toISOString(),
      level,
      event,
      ...(context === undefined ? {} : { context: redactForLog(context, this.secrets) }),
    });
  }

  info(event: string, context?: unknown): void { this.emit("info", event, context); }
  warn(event: string, context?: unknown): void { this.emit("warn", event, context); }
  error(event: string, context?: unknown): void { this.emit("error", event, context); }
}
