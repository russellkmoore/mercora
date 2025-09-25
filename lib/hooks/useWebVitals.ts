"use client";

import { useEffect } from "react";
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from "web-vitals";

interface ExtendedMetric extends Metric {
  url?: string;
  timestamp?: number;
  isMobile?: boolean;
  userAgent?: string;
}

export function useWebVitals() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldTrack =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_WEB_VITALS_DEV === "true";

    // Only run in production builds (unless explicitly enabled for dev)
    if (!shouldTrack) {
      return;
    }

    const sendToAnalytics = (metric: ExtendedMetric) => {
      const body = JSON.stringify({
        ...metric,
        url: window.location.pathname,
        timestamp: Date.now(),
        isMobile: /Mobi|Android/i.test(navigator.userAgent),
        userAgent: navigator.userAgent,
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/vitals", body);
      } else {
        fetch("/api/analytics/vitals", {
          body,
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(console.error);
      }
    };

    getCLS(sendToAnalytics);
    getFID(sendToAnalytics);
    getFCP(sendToAnalytics);
    getLCP(sendToAnalytics);
    getTTFB(sendToAnalytics);

    let touchStartTime = 0;
    const handleTouchStart = () => {
      touchStartTime = Date.now();
    };

    const handleTouchEnd = () => {
      if (!touchStartTime) {
        return;
      }

      const touchLatency = Date.now() - touchStartTime;
      if (touchLatency > 100) {
        sendToAnalytics({
          name: "touch-latency",
          value: touchLatency,
          id: Date.now().toString(),
          rating: touchLatency > 300 ? "poor" : touchLatency > 150 ? "needs-improvement" : "good",
          userAgent: navigator.userAgent,
          isMobile: true,
        } as ExtendedMetric);
      }
    };

    if ("ontouchstart" in window) {
      document.addEventListener("touchstart", handleTouchStart, { passive: true });
      document.addEventListener("touchend", handleTouchEnd, { passive: true });
    }

    return () => {
      if ("ontouchstart" in window) {
        document.removeEventListener("touchstart", handleTouchStart);
        document.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, []);
}
