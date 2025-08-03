#!/bin/bash

# Test current image performance with PNG sources
echo "🧪 Testing Current Image Performance (PNG → WebP via Cloudflare)"
echo "================================================================"

# Test image URL (from your CSV data)
IMAGE_BASE="https://voltique-images.russellkmoore.me"
TEST_IMAGE="products/vivid-mission-pack-0.png"

echo "🔍 Testing image transformations..."

# Test different sizes and formats
test_image_performance() {
    local width=$1
    local format=$2
    local url="${IMAGE_BASE}/cdn-cgi/image/width=${width},format=${format}/${TEST_IMAGE}"
    
    echo "Testing: ${width}px, ${format}"
    
    # Get response time and size
    result=$(curl -s -w "%{time_total},%{size_download},%{content_type}" -o /dev/null "$url")
    time=$(echo $result | cut -d',' -f1)
    size=$(echo $result | cut -d',' -f2)
    content_type=$(echo $result | cut -d',' -f3)
    
    echo "  ⏱️  Time: ${time}s"
    echo "  📦 Size: ${size} bytes"
    echo "  🖼️  Type: ${content_type}"
    echo ""
}

# Test current auto format
test_image_performance 800 "auto"
test_image_performance 400 "auto"

# Test PNG vs WebP directly
echo "📊 Format Comparison:"
test_image_performance 800 "png"
test_image_performance 800 "webp"

echo "✅ Performance test complete!"
echo ""
echo "💡 Analysis:"
echo "   - 'auto' format should deliver WebP to modern browsers"
echo "   - WebP should be 30-50% smaller than PNG"
echo "   - First request may be slower (cache miss)"
echo "   - Subsequent requests should be fast (edge cached)"
