"use client";

import { useEffect } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

interface CustomMetric extends Omit<Metric, "name"> {
  name: string;
}

type ExtendedMetric = (Metric | CustomMetric) & {
  url?: string;
  timestamp?: number;
  isMobile?: boolean;
  userAgent?: string;
};

export function useWebVitals() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldTrack =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_WEB_VITALS_DEV === "true";

    if (!shouldTrack) {
      return;
    }

    const sendToAnalytics = (metric: ExtendedMetric) => {
      const payload: ExtendedMetric = {
        ...metric,
        url: window.location.pathname,
        timestamp: Date.now(),
        isMobile: /Mobi|Android/i.test(navigator.userAgent),
        userAgent: navigator.userAgent,
      };
      const body = JSON.stringify(payload);

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/vitals", body);
      } else {
        fetch("/api/analytics/vitals", {
          body,
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch((error) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("Web Vitals analytics beacon failed", error);
          }
        });
      }
    };

    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onINP(sendToAnalytics, { reportAllChanges: true });
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);

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
        const touchMetric: ExtendedMetric = {
          name: "touch-latency",
          value: touchLatency,
          delta: touchLatency,
          id: Date.now().toString(),
          rating:
            touchLatency > 300
              ? "poor"
              : touchLatency > 150
                ? "needs-improvement"
                : "good",
          entries: [],
          navigationType: "navigate",
          userAgent: navigator.userAgent,
          isMobile: true,
        };

        sendToAnalytics(touchMetric);
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
