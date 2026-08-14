export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: unknown;
}

export type LogSink = (record: StructuredLogRecord) => void;

const sensitiveKey = /(?:access.?token|authorization|cookie|secret|password|email|phone|address|first.?name|last.?name|customer.?name)/i;
const emailLike = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function redactString(value: string, secrets: readonly string[]): string {
  let redacted = value.replace(emailLike, "[REDACTED]");
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}

export function redactForLog(value: unknown, secrets: readonly string[] = [], key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactForLog(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
        redactString(childKey, secrets),
        redactForLog(child, secrets, childKey),
      ]),
    );
  }
  return value;
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
