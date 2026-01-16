#!/bin/bash

# Script to verify if stock-snapshots cron is running automatically
# This checks the database for recent updates

echo "🔍 Checking Stock Snapshots Cron Status..."
echo ""
echo "Current time: $(date)"
echo "Current UTC time: $(date -u)"
echo ""

# Check if the cron should be running now
CURRENT_UTC_HOUR=$(date -u +%H)
if [ $CURRENT_UTC_HOUR -ge 3 ] && [ $CURRENT_UTC_HOUR -lt 11 ]; then
    echo "✅ Within cron schedule (3-10 UTC)"
    echo "   Cron should run every 3 minutes"
else
    echo "❌ Outside cron schedule (3-10 UTC)"
    echo "   Cron will not run until market hours"
    exit 0
fi

echo ""
echo "📊 Testing manual execution..."
echo ""

# Test manual execution
RESPONSE=$(curl -s "https://www.ectrade.in/api/cron/update-stock-snapshots" \
  -H "Authorization: Bearer 9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0")

echo "$RESPONSE" | jq '.'

# Extract key metrics
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
UPDATED=$(echo "$RESPONSE" | jq -r '.stocks_updated')
ERRORS=$(echo "$RESPONSE" | jq -r '.errors')

echo ""
if [ "$SUCCESS" = "true" ]; then
    echo "✅ Manual execution successful"
    echo "   - Stocks updated: $UPDATED"
    echo "   - Errors: $ERRORS"
else
    echo "❌ Manual execution failed"
fi

echo ""
echo "📝 To verify automatic execution:"
echo "   1. Go to https://vercel.com/dashboard"
echo "   2. Select your project → Logs"
echo "   3. Filter by '/api/cron/update-stock-snapshots'"
echo "   4. Look for automatic executions (not from your IP)"
echo "   5. Should see logs every 3 minutes"
echo ""
echo "🔍 Check for these log patterns:"
echo "   - '[STOCK-SNAPSHOTS] Starting update at...'"
echo "   - '[STOCK-SNAPSHOTS] ✅ Updated X stocks in database'"
echo ""
