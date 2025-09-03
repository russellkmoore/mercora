"use client";

import { useEffect } from 'react';

export default function WebVitals() {
  useEffect(() => {
    // Dynamic import to avoid SSR issues and reduce initial bundle size
    import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      
      function sendToAnalytics(metric: any) {
        // Add user agent and connection info for mobile analysis
        const body = JSON.stringify({
          ...metric,
          userAgent: navigator.userAgent,
          connection: (navigator as any).connection?.effectiveType || 'unknown',
          timestamp: Date.now(),
          url: window.location.pathname,
          referrer: document.referrer
        });

        // Use beacon API for reliability (works even if user navigates away)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics', body);
        } else {
          // Fallback for older browsers
          fetch('/api/analytics', {
            body,
            method: 'POST',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json'
            }
          }).catch(err => console.warn('Analytics failed:', err));
        }
      }

      // Track all Core Web Vitals
      onCLS(sendToAnalytics);
      onINP(sendToAnalytics);  // Interaction to Next Paint (replaces FID)
      onFCP(sendToAnalytics);
      onLCP(sendToAnalytics);
      onTTFB(sendToAnalytics);

      // Track mobile-specific events
      const trackMobileEvents = () => {
        let touchStartTime: number;
        
        // Touch response time tracking
        document.addEventListener('touchstart', (e) => {
          touchStartTime = Date.now();
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
          const touchDuration = Date.now() - touchStartTime;
          if (touchDuration > 100) {
            sendToAnalytics({
              name: 'touch-delay',
              value: touchDuration,
              element: (e.target as Element)?.tagName || 'unknown',
              id: `touch-${Date.now()}`,
              rating: touchDuration > 300 ? 'poor' : touchDuration > 150 ? 'needs-improvement' : 'good'
            });
          }
        }, { passive: true });

        // Orientation change tracking
        if (screen?.orientation) {
          screen.orientation.addEventListener('change', () => {
            setTimeout(() => {
              sendToAnalytics({
                name: 'orientation-change',
                value: screen.orientation.angle,
                viewport: {
                  width: window.innerWidth,
                  height: window.innerHeight
                },
                id: `orientation-${Date.now()}`,
                rating: 'good'
              });
            }, 100);
          });
        }
      };

      // Only track mobile events on mobile devices
      if (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent)) {
        trackMobileEvents();
      }
    });
  }, []);

  return null; // This component doesn't render anything
}