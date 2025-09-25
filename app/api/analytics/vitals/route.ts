import { NextRequest, NextResponse } from "next/server";

interface AnalyticsPayload {
  name: string;
  value: number;
  id?: string;
  rating?: string;
  url?: string;
  timestamp?: number;
  isMobile?: boolean;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const metric = (await request.json()) as AnalyticsPayload;

    if (process.env.NODE_ENV !== "production") {
      console.log("📊 Web Vital:", {
        name: metric.name,
        value: Math.round(metric.value),
        rating: metric.rating ?? "unknown",
        url: metric.url,
        isMobile: metric.isMobile ?? false,
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to track metric" }, { status: 500 });
  }
}
