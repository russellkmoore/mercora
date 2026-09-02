import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { toRouteTemplate } from "@/lib/observability/route-template";

interface AnalyticsPayload {
  name: string;
  value: number;
  rating?: string;
  url?: string;
  isMobile?: boolean;
}

/** The six metric names the client can send, per `lib/hooks/useWebVitals.ts`. */
const KNOWN_METRICS: ReadonlySet<string> = new Set([
  "CLS",
  "FCP",
  "INP",
  "LCP",
  "TTFB",
  "touch-latency",
]);

/** The three ratings the web-vitals library emits. */
const KNOWN_RATINGS: ReadonlySet<string> = new Set(["good", "needs-improvement", "poor"]);

const UNKNOWN_RATING = "unknown";

interface AnalyticsBinding {
  writeDataPoint: (event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }) => void;
}

/** A five-field vitals beacon fits comfortably in well under 1 KB; 4 KB leaves headroom. */
const MAX_VITALS_BODY_BYTES = 4096;

/**
 * Reads the request body up to `MAX_VITALS_BODY_BYTES`, checking `content-length`
 * up front and also bounding the actual bytes read (in case the header is absent
 * or understates the real size). Returns `null` on any oversized or malformed
 * length so the caller can fall through to the uniform 200-with-no-write response.
 */
async function readBoundedBody(request: NextRequest): Promise<Uint8Array | null> {
  const declaredHeader = request.headers.get("content-length");
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader)) return null;
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared > MAX_VITALS_BODY_BYTES) {
      return null;
    }
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > MAX_VITALS_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // Best-effort cancel; the oversized-body rejection below still applies.
      }
      return null;
    }
    chunks.push(chunk.value);
  }
  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

export async function POST(request: NextRequest) {
  let metric: AnalyticsPayload | undefined;
  try {
    const raw = await readBoundedBody(request);
    if (raw) {
      const parsed = JSON.parse(new TextDecoder().decode(raw));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metric = parsed as AnalyticsPayload;
      }
    }
  } catch {
    // Malformed or oversized body: fall through to the uniform 200 response with no write.
  }

  if (!metric) {
    return NextResponse.json({ status: "ok" });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("📊 Web Vital:", {
      name: metric.name,
      value: typeof metric.value === "number" ? Math.round(metric.value) : metric.value,
      rating: metric.rating ?? "unknown",
      url: metric.url,
      isMobile: metric.isMobile ?? false,
    });
  }

  const metricName = metric.name;
  const rawValue = metric.value;

  const isKnownMetric = typeof metricName === "string" && KNOWN_METRICS.has(metricName);
  const isValidValue =
    typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue >= 0;

  if (!isKnownMetric || !isValidValue) {
    return NextResponse.json({ status: "ok" });
  }

  // CLS is unitless and typically sub-1; store it as an integer count of
  // thousandths so the Analytics Engine double stays an integer like the
  // timing metrics. Divide by 1000 when reading CLS back out of the dataset.
  const value = metricName === "CLS" ? Math.round(rawValue * 1000) : Math.round(rawValue);

  const rating =
    typeof metric.rating === "string" && KNOWN_RATINGS.has(metric.rating)
      ? metric.rating
      : UNKNOWN_RATING;

  // Derived once; the raw beacon url is never read again after this line.
  const routeTemplate = toRouteTemplate(metric.url);
  const isMobile = metric.isMobile === true;

  let analytics: AnalyticsBinding | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & {
      WEB_VITALS?: AnalyticsBinding;
    };
    if (
      environment.WEB_VITALS &&
      typeof environment.WEB_VITALS.writeDataPoint === "function"
    ) {
      analytics = environment.WEB_VITALS;
    }
  } catch {
    analytics = undefined;
  }

  if (!analytics) {
    recordTelemetry("analytics.vitals_sink_unavailable", {
      operation: "persist",
      outcome: "unavailable",
      provider: "analytics",
    });
    return NextResponse.json({ status: "ok" });
  }

  try {
    analytics.writeDataPoint({
      blobs: [metricName, rating, routeTemplate, String(isMobile)],
      doubles: [value],
      indexes: [routeTemplate],
    });
  } catch {
    // Telemetry must always fail open; the beacon response never depends on it.
  }

  return NextResponse.json({ status: "ok" });
}
