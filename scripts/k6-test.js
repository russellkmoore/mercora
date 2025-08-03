import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

export let options = {
  // Realistic load testing options
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '1m', target: 5 },    // Stay at 5 users
    { duration: '30s', target: 10 },  // Ramp up to 10 users  
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = 'https://voltique.russellkmoore.me';

// Realistic user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

export default function() {
  // Simulate realistic user behavior
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  const params = {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  };

  // Test homepage
  console.log('🏠 Testing homepage...');
  let response = http.get(`${BASE_URL}/`, params);
  
  let success = check(response, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage response time < 2s': (r) => r.timings.duration < 2000,
    'homepage has products': (r) => r.body.includes('products') || r.body.includes('gear'),
  });
  
  errorRate.add(!success);
  
  if (response.status === 200) {
    console.log(`✅ Homepage loaded in ${response.timings.duration}ms`);
  } else {
    console.log(`❌ Homepage failed with status ${response.status}`);
  }

  // Simulate user reading page
  sleep(Math.random() * 3 + 2); // 2-5 seconds

  // Test a category page (simulate user navigation)
  if (Math.random() > 0.5) {
    console.log('📂 Testing category page...');
    response = http.get(`${BASE_URL}/category/featured`, params);
    
    success = check(response, {
      'category status is 200': (r) => r.status === 200,
      'category response time < 3s': (r) => r.timings.duration < 3000,
    });
    
    errorRate.add(!success);
    
    if (response.status === 200) {
      console.log(`✅ Category page loaded in ${response.timings.duration}ms`);
    }
    
    // Simulate user browsing
    sleep(Math.random() * 2 + 1); // 1-3 seconds
  }
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
📊 Load Test Results Summary:
==============================
🎯 Total Requests: ${data.metrics.http_reqs.values.count}
✅ Success Rate: ${(100 - data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
⚡ Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
📈 95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
🔥 Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms
⏱️  Min Response Time: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms

Response Time Breakdown:
- DNS Lookup: ${data.metrics.http_req_connecting ? data.metrics.http_req_connecting.values.avg.toFixed(2) : 'N/A'}ms
- Connection: ${data.metrics.http_req_connecting ? data.metrics.http_req_connecting.values.avg.toFixed(2) : 'N/A'}ms  
- TLS Handshake: ${data.metrics.http_req_tls_handshaking ? data.metrics.http_req_tls_handshaking.values.avg.toFixed(2) : 'N/A'}ms
- First Byte: ${data.metrics.http_req_waiting ? data.metrics.http_req_waiting.values.avg.toFixed(2) : 'N/A'}ms

🚀 Throughput: ${data.metrics.http_reqs.values.rate.toFixed(2)} requests/second
`,
  };
}
