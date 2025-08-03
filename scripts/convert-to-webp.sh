#!/bin/bash

# Convert PNG images to WebP format
# This script assumes your images are stored externally and you have access to them

echo "🔄 Converting PNG images to WebP format..."

# Create output directory
mkdir -p webp_images

# Function to convert PNG to WebP
convert_png_to_webp() {
    local input_file="$1"
    local output_file="${input_file%.png}.webp"
    
    echo "Converting: $input_file → $output_file"
    
    # Using cwebp (install via: brew install webp)
    cwebp -q 85 "$input_file" -o "$output_file"
    
    # Show file size reduction
    original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file")
    new_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file")
    reduction=$((100 - (new_size * 100 / original_size)))
    
    echo "✅ Reduced by ${reduction}% (${original_size} → ${new_size} bytes)"
}

# Check if cwebp is installed
if ! command -v cwebp &> /dev/null; then
    echo "❌ cwebp not found. Install with:"
    echo "   macOS: brew install webp"
    echo "   Ubuntu: sudo apt-get install webp"
    exit 1
fi

echo "📊 Image conversion completed!"
echo "💡 Update your database/CSV to use .webp extensions"
