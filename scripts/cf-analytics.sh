#!/bin/bash

# Cloudflare Analytics Monitoring Script
# This pulls real performance data from Cloudflare without triggering rate limits

echo "📊 Cloudflare Analytics Performance Monitor"
echo "=========================================="

# Check if CF credentials are set
if [[ -z "$CF_API_TOKEN" ]]; then
    echo "❌ Error: CF_API_TOKEN environment variable not set"
    echo "   Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
    exit 1
fi

if [[ -z "$CF_ZONE_ID" ]]; then
    echo "❌ Error: CF_ZONE_ID environment variable not set"
    echo "   Find your Zone ID in the Cloudflare dashboard"
    exit 1
fi

# Date range (last 24 hours)
END_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
START_DATE=$(date -u -d "24 hours ago" +"%Y-%m-%dT%H:%M:%SZ")

echo "📅 Analyzing data from $START_DATE to $END_DATE"
echo ""

# Function to query CF Analytics API
query_analytics() {
    local query="$1"
    local title="$2"
    
    echo "🔍 $title"
    echo "----------------------------------------"
    
    curl -s -X POST "https://api.cloudflare.com/client/v4/graphql/" \
         -H "Authorization: Bearer $CF_API_TOKEN" \
         -H "Content-Type: application/json" \
         --data "{\"query\":\"$query\"}" | \
    jq -r '.data.viewer.zones[0].httpRequests1dGroups[0] // empty | 
           "Requests: \(.sum.requests // 0)",
           "Avg Response Time: \(.avg.originResponseTime // 0)ms", 
           "95th Percentile: \(.quantiles.originResponseTime.p95 // 0)ms",
           "Cache Hit Rate: \((.sum.cachedRequests // 0) * 100 / (.sum.requests // 1) | floor)%",
           "Bandwidth: \((.sum.bytes // 0) / 1024 / 1024 | floor)MB"'
    
    echo ""
}

# Query overall performance
OVERALL_QUERY="query {
  viewer {
    zones(filter: {zoneTag: \"$CF_ZONE_ID\"}) {
      httpRequests1dGroups(
        orderBy: [datetimeMinute_ASC]
        limit: 1000
        filter: {
          datetime_geq: \"$START_DATE\"
          datetime_leq: \"$END_DATE\"
        }
      ) {
        sum {
          requests
          cachedRequests
          bytes
        }
        avg {
          originResponseTime
        }
        quantiles {
          originResponseTime {
            p95
            p99
          }
        }
      }
    }
  }
}"

query_analytics "$OVERALL_QUERY" "Overall Performance (24h)"

# Query by status code
STATUS_QUERY="query {
  viewer {
    zones(filter: {zoneTag: \"$CF_ZONE_ID\"}) {
      httpRequests1dGroups(
        orderBy: [edgeResponseStatus_ASC]
        limit: 10
        filter: {
          datetime_geq: \"$START_DATE\"
          datetime_leq: \"$END_DATE\"
        }
      ) {
        dimensions {
          edgeResponseStatus
        }
        sum {
          requests
        }
      }
    }
  }
}"

echo "🚦 Response Status Breakdown"
echo "----------------------------------------"
curl -s -X POST "https://api.cloudflare.com/client/v4/graphql/" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data "{\"query\":\"$STATUS_QUERY\"}" | \
jq -r '.data.viewer.zones[0].httpRequests1dGroups[] | 
       "Status \(.dimensions.edgeResponseStatus): \(.sum.requests) requests"'

echo ""

# Query top paths
PATHS_QUERY="query {
  viewer {
    zones(filter: {zoneTag: \"$CF_ZONE_ID\"}) {
      httpRequests1dGroups(
        orderBy: [sum_requests_DESC]
        limit: 10
        filter: {
          datetime_geq: \"$START_DATE\"
          datetime_leq: \"$END_DATE\"
        }
      ) {
        dimensions {
          clientRequestPath
        }
        sum {
          requests
        }
        avg {
          originResponseTime
        }
      }
    }
  }
}"

echo "🔥 Top Requested Paths"
echo "----------------------------------------"
curl -s -X POST "https://api.cloudflare.com/client/v4/graphql/" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data "{\"query\":\"$PATHS_QUERY\"}" | \
jq -r '.data.viewer.zones[0].httpRequests1dGroups[] | 
       "\(.sum.requests) requests - \(.dimensions.clientRequestPath) (avg: \(.avg.originResponseTime)ms)"'

echo ""
echo "💡 Tips:"
echo "- Set CF_API_TOKEN and CF_ZONE_ID environment variables"
echo "- Run this script regularly to monitor performance trends"
echo "- No rate limiting concerns - uses official Cloudflare API"
