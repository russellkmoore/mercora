# Load Testing Strategy for Cloudflare-Protected Sites

## 🎯 **Recommended Approach**

Since your site is behind Cloudflare's protection, traditional single-IP load testing will trigger rate limiting. Here are the best strategies:

## 1. **Conservative Local Testing** ✅
```bash
# Use our modified script with realistic delays
./scripts/load-test.sh 3 5  # 3 users, 5 requests each
```
- **Safe**: Won't trigger Cloudflare blocks
- **Realistic**: Uses proper headers and delays
- **Good for**: Development and baseline testing

## 2. **k6 Distributed Testing** ⭐ (Recommended)
```bash
# Install k6
brew install k6

# Run locally (conservative)
k6 run scripts/k6-test.js

# Run on k6 Cloud (distributed - BEST option)
k6 cloud scripts/k6-test.js
```
- **Distributed**: Tests from multiple global locations
- **Realistic**: Simulates real user behavior  
- **Free tier**: 50 Virtual Users
- **Professional**: Detailed metrics and reporting

## 3. **Cloudflare Analytics** 📊 (Best for Real Data)
```bash
# Set up credentials
export CF_API_TOKEN="your_api_token"
export CF_ZONE_ID="your_zone_id"

# Get real performance data
./scripts/cf-analytics.sh
```
- **Real data**: Actual user performance metrics
- **No rate limits**: Uses official Cloudflare API
- **Comprehensive**: Response times, cache rates, error rates

## 4. **External Load Testing Services**

### Loader.io (Free tier)
1. Sign up at https://loader.io
2. Verify domain ownership
3. Run distributed tests from multiple locations

### GTmetrix/WebPageTest
- **Single-point testing** from global locations
- **Waterfall analysis** of resource loading
- **Core Web Vitals** monitoring

## 🎯 **Getting Your Numbers**

### For Dashboard Metrics:
1. **Use Cloudflare Analytics** - Real user data
2. **Set up New Relic Browser monitoring** - Already configured
3. **Use k6 Cloud** - Professional load testing metrics

### Quick Start Commands:
```bash
# 1. Conservative local test
./scripts/load-test.sh 2 3

# 2. Get real Cloudflare data  
./scripts/cf-analytics.sh

# 3. Run k6 test
k6 run scripts/k6-test.js

# 4. Professional distributed test
k6 cloud scripts/k6-test.js
```

## 📈 **Expected Results After Optimization**

Based on your recent improvements:
- **Before**: ~850ms average response time
- **After**: ~255ms average response time  
- **Improvement**: 70% faster page loads

### What to Monitor:
- **Response time percentiles** (P50, P95, P99)
- **Cache hit rates** (should be high for static assets)
- **Error rates** (should be <1%)
- **Throughput** (requests per second)
- **Time to First Byte** (TTFB)

## 🚫 **What NOT to Do**
- ❌ High-frequency requests from single IP
- ❌ Missing browser headers
- ❌ Obvious bot patterns
- ❌ Ignoring Cloudflare's robots.txt

## ✅ **Best Practices**
- ✅ Use realistic user agents and headers
- ✅ Add delays between requests (2-8 seconds)
- ✅ Rotate request patterns
- ✅ Test different pages, not just homepage
- ✅ Monitor real user metrics alongside synthetic tests
