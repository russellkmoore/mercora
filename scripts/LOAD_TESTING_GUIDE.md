# Load Testing Options for Cloudflare-Protected Sites

## ⚠️ Important Note
Single-IP load testing will trigger Cloudflare's DDoS protection. Here are better approaches:

## Option 1: Distributed Load Testing Services (Recommended)

### 1. **Loader.io** (Free tier available)
```bash
# 1. Sign up at https://loader.io
# 2. Verify domain ownership
# 3. Create test with these settings:
#    - Test Type: Maintaining client load
#    - Clients: 25-100 (start small)
#    - Duration: 1 minute
#    - URLs: https://voltique.russellkmoore.me/
```

### 2. **k6 Cloud** (Free tier: 50 VUs)
```bash
# Install k6
brew install k6

# Create test script (see k6-test.js)
k6 run --vus 10 --duration 30s k6-test.js

# Or run on k6 Cloud for distributed testing
k6 cloud k6-test.js
```

### 3. **Artillery.io** 
```bash
npm install -g artillery

# Run distributed test (see artillery-config.yml)
artillery run artillery-config.yml
```

## Option 2: Multiple IP Sources

### Use Different Networks
- Run tests from different locations (home, office, mobile hotspot)
- Use VPN to change IP addresses
- Ask team members to run concurrent tests

### Cloud-Based Testing
- Spin up VMs in different AWS/GCP regions
- Use GitHub Actions with different runners
- Use Cloudflare Workers to test from edge locations

## Option 3: Realistic User Simulation

### Browser-Based Testing
- Use Playwright/Puppeteer for real browser testing
- Simulate actual user interactions (clicks, scrolls, form fills)
- Test different pages, not just homepage

### Monitoring Integration
- Use Cloudflare Analytics API to pull metrics
- Set up New Relic Synthetics for continuous monitoring
- Monitor Core Web Vitals during tests

## Recommended Approach

1. **Start with Cloudflare Analytics**: Monitor current baseline
2. **Use loader.io**: Free distributed testing
3. **Set up Synthetic Monitoring**: Continuous performance tracking
4. **Supplement with local testing**: Our conservative script for development

## Cloudflare Rate Limiting Thresholds
- ~10-20 requests/minute from single IP = usually fine
- >100 requests/minute from single IP = likely blocked
- Consistent patterns = triggers bot detection
- Missing browser headers = triggers challenge

## Better Metrics Sources
- Cloudflare Analytics Dashboard
- Real User Monitoring (RUM)
- New Relic Browser monitoring
- Core Web Vitals from Search Console
