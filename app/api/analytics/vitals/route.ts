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

export async function POST(request: NextRequest) {
  let metric: AnalyticsPayload | undefined;
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metric = parsed as AnalyticsPayload;
    }
  } catch {
    // Malformed body: fall through to the uniform 200 response with no write.
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
