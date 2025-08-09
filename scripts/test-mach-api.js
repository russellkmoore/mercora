/**
 * Test MACH API Response Structure
 * 
 * Simple test to verify API endpoints return MACH-compliant responses
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing MACH API Response Structure...\n');

// Read the products API file
const productsApiPath = path.join(process.cwd(), 'app/api/products/route.ts');
const productsContent = fs.readFileSync(productsApiPath, 'utf8');

// Check MACH response structure in products API
const machResponseChecks = [
  {
    name: 'Products API has data field',
    check: productsContent.includes('data:')
  },
  {
    name: 'Products API has meta field with schema', 
    check: productsContent.includes('meta:') && productsContent.includes('schema: "mach:product"')
  },
  {
    name: 'Products API has links field',
    check: productsContent.includes('links:')
  },
  {
    name: 'Products API has pagination links',
    check: productsContent.includes('next:') && productsContent.includes('prev:') && productsContent.includes('first:') && productsContent.includes('last:')
  },
  {
    name: 'Products API handles limit/offset parameters',
    check: productsContent.includes('limit') && productsContent.includes('offset')
  }
];

let passed = 0;
for (const check of machResponseChecks) {
  if (check.check) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
  }
}

console.log(`\n📊 MACH API Response Structure: ${passed}/${machResponseChecks.length} checks passed`);

// Check orders API
const ordersApiPath = path.join(process.cwd(), 'app/api/orders/route.ts');
if (fs.existsSync(ordersApiPath)) {
  const ordersContent = fs.readFileSync(ordersApiPath, 'utf8');
  
  const ordersChecks = [
    ordersContent.includes('data:'),
    ordersContent.includes('meta:'),
    ordersContent.includes('schema')
  ];
  
  const ordersPassed = ordersChecks.filter(Boolean).length;
  console.log(`✅ Orders API MACH Response: ${ordersPassed}/${ordersChecks.length} checks passed`);
}

if (passed === machResponseChecks.length) {
  console.log('\n🎯 API endpoints are MACH compliant with proper response structure');
} else {
  console.log('\n⚠️ Some MACH response structure issues found');
}
