# Mobile Testing Automation Setup

> **Setup Guide**: Automated mobile testing and performance monitoring for Mercora  
> **Updated**: September 2, 2025

## 🚀 Quick Start Commands

```bash
# Run lighthouse audit locally
npm run lighthouse:mobile

# Run mobile testing suite
npm run test:mobile

# Start performance monitoring
npm run monitor:mobile

# Generate mobile report
npm run report:mobile
```

## 📋 Lighthouse CI Configuration

### **`.lighthouserc.json`**
```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/category/featured",
        "http://localhost:3000/product/vivid-mission-pack",
        "http://localhost:3000/checkout"
      ],
      "settings": {
        "preset": "desktop",
        "onlyCategories": ["performance", "accessibility", "best-practices", "seo"],
        "skipAudits": ["uses-http2"]
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["error", {"minScore": 0.85}],
        "categories:seo": ["error", {"minScore": 0.9}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1500}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 200}],
        "speed-index": ["error", {"maxNumericValue": 3000}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### **Mobile-Specific Lighthouse Config**
```json
{
  "extends": "lighthouse:default",
  "settings": {
    "emulatedFormFactor": "mobile",
    "throttling": {
      "rttMs": 40,
      "throughputKbps": 10240,
      "cpuSlowdownMultiplier": 1
    },
    "screenEmulation": {
      "mobile": true,
      "width": 375,
      "height": 667,
      "deviceScaleFactor": 2,
      "disabled": false
    }
  }
}
```

## 🔍 Core Web Vitals Monitoring

### **Web Vitals Implementation**
```javascript
// lib/utils/web-vitals.js
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function sendToAnalytics(metric) {
  const body = JSON.stringify({
    ...metric,
    url: window.location.pathname,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    connection: navigator.connection?.effectiveType || 'unknown'
  });

  // Use navigator.sendBeacon when available for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  } else {
    fetch('/api/analytics/vitals', {
      body,
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(console.error);
  }
}

export function initWebVitals() {
  // Only track on production and for real users
  if (process.env.NODE_ENV !== 'production') return;
  
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);

  // Track mobile-specific metrics
  if ('ontouchstart' in window) {
    trackMobileMetrics();
  }
}

function trackMobileMetrics() {
  let touchStartTime;
  let scrollStartTime;

  // Track touch responsiveness
  document.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (touchStartTime) {
      const touchLatency = Date.now() - touchStartTime;
      if (touchLatency > 100) { // Only track slow touches
        sendToAnalytics({
          name: 'touch-latency',
          value: touchLatency,
          id: Date.now().toString(),
          element: e.target.tagName.toLowerCase()
        });
      }
    }
  }, { passive: true });

  // Track scroll performance
  let scrollCount = 0;
  document.addEventListener('scroll', () => {
    if (!scrollStartTime) {
      scrollStartTime = Date.now();
    }
    scrollCount++;
  }, { passive: true });

  // Track orientation changes
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      sendToAnalytics({
        name: 'orientation-change',
        value: screen.orientation?.angle || 0,
        id: Date.now().toString(),
        viewport: `${window.innerWidth}x${window.innerHeight}`
      });
    }, 100);
  });

  // Track viewport changes (for responsive design testing)
  let lastViewportSize = `${window.innerWidth}x${window.innerHeight}`;
  window.addEventListener('resize', () => {
    const currentViewportSize = `${window.innerWidth}x${window.innerHeight}`;
    if (currentViewportSize !== lastViewportSize) {
      sendToAnalytics({
        name: 'viewport-change',
        value: window.innerWidth,
        id: Date.now().toString(),
        from: lastViewportSize,
        to: currentViewportSize
      });
      lastViewportSize = currentViewportSize;
    }
  });
}
```

### **Analytics API Route**
```javascript
// app/api/analytics/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Web Vital:', {
        name: metric.name,
        value: Math.round(metric.value),
        rating: metric.rating || 'unknown',
        url: metric.url
      });
    }

    // In production, send to your analytics service
    // Example: Google Analytics 4, Mixpanel, or custom analytics
    if (process.env.NODE_ENV === 'production') {
      // await sendToAnalyticsService(metric);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to track metric' }, { status: 500 });
  }
}
```

## 🧪 Automated Mobile Testing

### **Playwright Mobile Testing Setup**
```javascript
// tests/mobile/mobile-navigation.spec.js
import { test, expect, devices } from '@playwright/test';

const mobileDevices = [
  'iPhone 12',
  'iPhone SE',
  'Samsung Galaxy S21'
];

mobileDevices.forEach(deviceName => {
  test.describe(`Mobile Navigation - ${deviceName}`, () => {
    test.use({ ...devices[deviceName] });

    test('should open and navigate mobile menu', async ({ page }) => {
      await page.goto('/');
      
      // Test mobile menu trigger
      const menuButton = page.getByRole('button', { name: /menu/i });
      await expect(menuButton).toBeVisible();
      await menuButton.tap();
      
      // Test category navigation
      const categoryLink = page.getByText('Featured');
      await expect(categoryLink).toBeVisible();
      await categoryLink.tap();
      
      await expect(page).toHaveURL(/\/category\/featured/);
    });

    test('should handle cart interactions on mobile', async ({ page }) => {
      await page.goto('/product/vivid-mission-pack');
      
      // Add to cart
      const addToCartButton = page.getByText('Add to Cart');
      await addToCartButton.tap();
      
      // Open cart
      const cartButton = page.getByRole('button', { name: /cart/i });
      await cartButton.tap();
      
      // Verify cart contents
      await expect(page.getByText('Vivid Mission Pack')).toBeVisible();
      
      // Test quantity controls
      const increaseButton = page.getByRole('button', { name: '+' });
      await increaseButton.tap();
      
      // Verify quantity updated
      await expect(page.getByText('2')).toBeVisible();
    });

    test('should complete checkout flow on mobile', async ({ page }) => {
      // Add item to cart first
      await page.goto('/product/vivid-mission-pack');
      await page.getByText('Add to Cart').tap();
      
      // Go to checkout
      await page.goto('/checkout');
      
      // Fill shipping form
      await page.fill('[name="recipient"]', 'John Doe');
      await page.fill('[name="email"]', 'john@example.com');
      await page.fill('[name="line1"]', '123 Test St');
      await page.fill('[name="city"]', 'New York');
      await page.selectOption('[name="region"]', 'NY');
      await page.fill('[name="postal_code"]', '10001');
      
      const submitButton = page.getByRole('button', { name: /continue/i });
      await submitButton.tap();
      
      // Wait for shipping options
      await expect(page.getByText(/shipping method/i)).toBeVisible();
    });
  });
});
```

### **Performance Testing**
```javascript
// tests/mobile/mobile-performance.spec.js
import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Performance', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    // Start performance monitoring
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // Mock web-vitals library behavior
        if (window.getCLS) {
          window.getCLS((metric) => vitals.cls = metric.value);
        }
        if (window.getLCP) {
          window.getLCP((metric) => vitals.lcp = metric.value);
        }
        if (window.getFID) {
          window.getFID((metric) => vitals.fid = metric.value);
        }
        
        setTimeout(() => resolve(vitals), 3000);
      });
    });
    
    // Assert Core Web Vitals thresholds
    if (vitals.lcp) expect(vitals.lcp).toBeLessThan(2500);
    if (vitals.cls) expect(vitals.cls).toBeLessThan(0.1);
    if (vitals.fid) expect(vitals.fid).toBeLessThan(100);
  });

  test('should load product pages quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/product/vivid-mission-pack');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // 3 second threshold
  });
});
```

## 📱 Device Testing Matrix Automation

### **Cross-Device Testing Script**
```javascript
// scripts/mobile-test-matrix.js
const { chromium, devices } = require('playwright');

const testMatrix = [
  { name: 'iPhone SE', device: 'iPhone SE' },
  { name: 'iPhone 12', device: 'iPhone 12' },
  { name: 'iPhone 14 Pro Max', device: 'iPhone 14 Pro Max' },
  { name: 'Samsung Galaxy S21', device: 'Samsung Galaxy S21' },
  { name: 'iPad Mini', device: 'iPad Mini' }
];

const criticalPaths = [
  '/',
  '/category/featured',
  '/product/vivid-mission-pack',
  '/checkout'
];

async function runMobileTestMatrix() {
  const browser = await chromium.launch();
  
  for (const { name, device } of testMatrix) {
    console.log(`\\n🧪 Testing on ${name}...`);
    
    const context = await browser.newContext({
      ...devices[device],
      locale: 'en-US'
    });
    
    const page = await context.newPage();
    
    for (const path of criticalPaths) {
      try {
        console.log(`  📱 Testing ${path}...`);
        
        const startTime = Date.now();
        await page.goto(`http://localhost:3000${path}`, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        const loadTime = Date.now() - startTime;
        
        // Take screenshot
        await page.screenshot({ 
          path: `screenshots/mobile-${device.replace(' ', '-')}-${path.replace('/', 'home') || 'home'}.png`,
          fullPage: true 
        });
        
        console.log(`    ✅ Loaded in ${loadTime}ms`);
        
        // Test basic interactions
        if (path === '/') {
          await page.getByText('Shop Featured Gear').tap();
          console.log('    ✅ Hero CTA works');
        }
        
        if (path.includes('/product/')) {
          const addToCartBtn = page.locator('text=Add to Cart').first();
          if (await addToCartBtn.isVisible()) {
            await addToCartBtn.tap();
            console.log('    ✅ Add to cart works');
          }
        }
        
      } catch (error) {
        console.log(`    ❌ Failed: ${error.message}`);
      }
    }
    
    await context.close();
  }
  
  await browser.close();
  console.log('\\n🎉 Mobile testing matrix complete!');
}

if (require.main === module) {
  runMobileTestMatrix();
}

module.exports = { runMobileTestMatrix };
```

## 📊 Performance Dashboard

### **Real-Time Mobile Metrics Dashboard**
```javascript
// components/admin/MobileDashboard.tsx
"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

interface MobileMetric {
  name: string;
  value: number;
  timestamp: number;
  device?: string;
}

export default function MobileDashboard() {
  const [metrics, setMetrics] = useState<MobileMetric[]>([]);
  
  useEffect(() => {
    // Poll for metrics every 30 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/analytics/mobile-metrics');
        const data = await response.json();
        setMetrics(data.metrics || []);
      } catch (error) {
        console.error('Failed to fetch mobile metrics:', error);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getAverageMetric = (metricName: string) => {
    const relevantMetrics = metrics.filter(m => m.name === metricName);
    if (relevantMetrics.length === 0) return 0;
    return relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;
  };
  
  const getMetricStatus = (value: number, thresholds: {good: number, poor: number}) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">LCP (Mobile)</h3>
        <div className="text-2xl font-bold">
          {Math.round(getAverageMetric('largest-contentful-paint'))}ms
        </div>
        <div className={`text-sm ${
          getMetricStatus(getAverageMetric('largest-contentful-paint'), {good: 2500, poor: 4000}) === 'good' 
            ? 'text-green-600' : 'text-red-600'
        }`}>
          Target: < 2500ms
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">FID (Mobile)</h3>
        <div className="text-2xl font-bold">
          {Math.round(getAverageMetric('first-input-delay'))}ms
        </div>
        <div className={`text-sm ${
          getMetricStatus(getAverageMetric('first-input-delay'), {good: 100, poor: 300}) === 'good' 
            ? 'text-green-600' : 'text-red-600'
        }`}>
          Target: < 100ms
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">CLS (Mobile)</h3>
        <div className="text-2xl font-bold">
          {getAverageMetric('cumulative-layout-shift').toFixed(3)}
        </div>
        <div className={`text-sm ${
          getMetricStatus(getAverageMetric('cumulative-layout-shift'), {good: 0.1, poor: 0.25}) === 'good' 
            ? 'text-green-600' : 'text-red-600'
        }`}>
          Target: < 0.1
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Touch Latency</h3>
        <div className="text-2xl font-bold">
          {Math.round(getAverageMetric('touch-latency'))}ms
        </div>
        <div className={`text-sm ${
          getMetricStatus(getAverageMetric('touch-latency'), {good: 100, poor: 200}) === 'good' 
            ? 'text-green-600' : 'text-red-600'
        }`}>
          Target: < 100ms
        </div>
      </Card>
    </div>
  );
}
```

## 🔧 npm Scripts Setup

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "lighthouse:mobile": "lighthouse http://localhost:3000 --preset=desktop --view --chrome-flags='--headless'",
    "test:mobile": "playwright test tests/mobile/",
    "test:mobile:headed": "playwright test tests/mobile/ --headed",
    "monitor:mobile": "node scripts/mobile-test-matrix.js",
    "report:mobile": "lighthouse-ci --config=.lighthouserc.json",
    "vitals:track": "node scripts/track-vitals.js"
  }
}
```

---

**Setup Priority:**
1. Install dependencies: `npm install --save-dev playwright lighthouse @playwright/test`
2. Configure Lighthouse CI
3. Set up Core Web Vitals tracking
4. Run initial mobile test matrix
5. Create performance monitoring dashboard