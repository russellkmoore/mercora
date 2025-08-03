#!/bin/bash

# Cloudflare-friendly load test script for Voltique
# Usage: ./load-test.sh [concurrent_users] [requests_per_user] [url]

CONCURRENT_USERS=${1:-3}  # Reduced default to avoid rate limiting
REQUESTS_PER_USER=${2:-5}  # Reduced default
URL=${3:-"https://voltique.russellkmoore.me/"}

echo "🚀 Starting Cloudflare-friendly load test..."
echo "   URL: $URL"
echo "   Concurrent users: $CONCURRENT_USERS"
echo "   Requests per user: $REQUESTS_PER_USER"
echo "   Total requests: $((CONCURRENT_USERS * REQUESTS_PER_USER))"
echo "⚠️  Note: Using conservative limits to avoid Cloudflare rate limiting"
echo ""

# Create temp directory for results
TEMP_DIR=$(mktemp -d)
echo "📊 Results will be stored in: $TEMP_DIR"

# Array of realistic User-Agent strings to rotate
USER_AGENTS=(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Function to run requests for a single user
run_user_requests() {
    local user_id=$1
    local output_file="$TEMP_DIR/user_${user_id}.log"
    
    echo "Starting user $user_id..." >> "$output_file"
    
    for ((i=1; i<=REQUESTS_PER_USER; i++)); do
        # Rotate User-Agent to simulate different browsers
        local ua_index=$((($user_id + $i) % ${#USER_AGENTS[@]}))
        local user_agent="${USER_AGENTS[$ua_index]}"
        
        echo -n "User $user_id, Request $i: " >> "$output_file"
        
        # Add realistic headers and longer delays to avoid rate limiting
        curl -w "Status: %{http_code}, Time: %{time_total}s, Size: %{size_download} bytes, DNS: %{time_namelookup}s, Connect: %{time_connect}s, SSL: %{time_appconnect}s, FirstByte: %{time_starttransfer}s\n" \
             -s -o /dev/null \
             -H "User-Agent: $user_agent" \
             -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
             -H "Accept-Language: en-US,en;q=0.5" \
             -H "Accept-Encoding: gzip, deflate, br" \
             -H "DNT: 1" \
             -H "Connection: keep-alive" \
             -H "Upgrade-Insecure-Requests: 1" \
             -H "Cache-Control: no-cache" \
             --compressed \
             "$URL" >> "$output_file"
        
        # Longer delay between requests (2-8 seconds) to be respectful
        sleep $(shuf -i 2-8 -n 1)
    done
    
    echo "User $user_id completed" >> "$output_file"
}

# Start timestamp
START_TIME=$(date +%s)

# Launch concurrent users
for ((user=1; user<=CONCURRENT_USERS; user++)); do
    run_user_requests $user &
done

# Wait for all users to complete
wait

# End timestamp
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo ""
echo "✅ Load test completed in ${TOTAL_TIME} seconds"
echo ""

# Analyze results
echo "📈 Results Summary:"
echo "=================="

# Collect all response times
grep "Time:" "$TEMP_DIR"/*.log | cut -d' ' -f4 | sed 's/s//' > "$TEMP_DIR/times.txt"

# Calculate statistics
TOTAL_REQUESTS=$(wc -l < "$TEMP_DIR/times.txt")
AVG_TIME=$(awk '{sum+=$1} END {print sum/NR}' "$TEMP_DIR/times.txt")
MIN_TIME=$(sort -n "$TEMP_DIR/times.txt" | head -1)
MAX_TIME=$(sort -n "$TEMP_DIR/times.txt" | tail -1)

# Calculate percentiles
P50=$(sort -n "$TEMP_DIR/times.txt" | awk -v p=50 'NR==int(NR*p/100)+1{print $1}')
P95=$(sort -n "$TEMP_DIR/times.txt" | awk -v p=95 'NR==int(NR*p/100)+1{print $1}')
P99=$(sort -n "$TEMP_DIR/times.txt" | awk -v p=99 'NR==int(NR*p/100)+1{print $1}')

# Error rate
SUCCESS_COUNT=$(grep "Status: 200" "$TEMP_DIR"/*.log | wc -l)
ERROR_COUNT=$((TOTAL_REQUESTS - SUCCESS_COUNT))
ERROR_RATE=$(echo "scale=2; $ERROR_COUNT * 100 / $TOTAL_REQUESTS" | bc)

echo "Total Requests: $TOTAL_REQUESTS"
echo "Successful: $SUCCESS_COUNT"
echo "Errors: $ERROR_COUNT ($ERROR_RATE%)"
echo ""
echo "Response Times:"
echo "  Average: ${AVG_TIME}s"
echo "  Minimum: ${MIN_TIME}s"
echo "  Maximum: ${MAX_TIME}s"
echo "  50th percentile: ${P50}s"
echo "  95th percentile: ${P95}s"
echo "  99th percentile: ${P99}s"
echo ""
echo "Throughput: $(echo "scale=2; $TOTAL_REQUESTS / $TOTAL_TIME" | bc) requests/second"
echo ""

# Show detailed logs location
echo "🔍 Detailed logs available in: $TEMP_DIR"
echo "   View with: cat $TEMP_DIR/*.log"

# Clean up option
echo ""
read -p "Delete temporary files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEMP_DIR"
    echo "Temporary files deleted."
else
    echo "Logs preserved in: $TEMP_DIR"
fi
