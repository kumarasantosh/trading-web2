#!/bin/bash

# Script to check if stock snapshots cron is working
# This checks the database to see when data was last updated

echo "🔍 Checking Stock Snapshots Cron Status"
echo "========================================"
echo ""

# Check current time
echo "Current Time (IST): $(TZ='Asia/Kolkata' date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Current Time (UTC): $(TZ='UTC' date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# Market hours check
HOUR=$(TZ='Asia/Kolkata' date '+%H')
MINUTE=$(TZ='Asia/Kolkata' date '+%M')
DAY=$(date '+%u')  # 1=Monday, 7=Sunday

if [ "$DAY" -eq 6 ] || [ "$DAY" -eq 7 ]; then
    echo "⚠️  Weekend - Market is closed"
elif [ "$HOUR" -lt 9 ] || [ "$HOUR" -gt 15 ]; then
    echo "⚠️  Outside market hours (9:15 AM - 3:30 PM IST)"
elif [ "$HOUR" -eq 9 ] && [ "$MINUTE" -lt 15 ]; then
    echo "⚠️  Before market open (9:15 AM IST)"
elif [ "$HOUR" -eq 15 ] && [ "$MINUTE" -gt 30 ]; then
    echo "⚠️  After market close (3:30 PM IST)"
else
    echo "✅ Market is currently open"
fi

echo ""
echo "Expected Cron Behavior:"
echo "- Should run every 3 minutes during 3-10 UTC (8:30 AM - 4:29 PM IST)"
echo "- Next run should be within 3 minutes if market is open"
echo ""

# Instructions for checking Vercel
echo "📋 How to verify the cron is running:"
echo ""
echo "1. Check Vercel Logs:"
echo "   - Go to: https://vercel.com/dashboard"
echo "   - Select your project"
echo "   - Click 'Logs' tab"
echo "   - Filter by: /api/cron/update-stock-snapshots"
echo "   - Look for entries every 3 minutes"
echo ""
echo "2. Check Supabase Database:"
echo "   - Go to: https://supabase.com/dashboard"
echo "   - Select your project"
echo "   - Go to Table Editor → stock_snapshots"
echo "   - Check 'updated_at' column for recent timestamps"
echo ""
echo "3. Check Environment Variables in Vercel:"
echo "   - Go to: Settings → Environment Variables"
echo "   - Verify these are set for Production:"
echo "     ✓ CRON_SECRET"
echo "     ✓ GROWW_API_TOKEN"
echo "     ✓ GROWW_API_KEY"
echo "     ✓ GROWW_API_SECRET"
echo "     ✓ SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "4. Test the endpoint manually:"
echo "   Run: ./test-stock-snapshots.sh"
echo ""

# Check if we can query Supabase
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "🔍 Checking last update time from Supabase..."
    
    RESPONSE=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/stock_snapshots?select=updated_at&order=updated_at.desc&limit=1" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")
    
    if echo "$RESPONSE" | grep -q "updated_at"; then
        LAST_UPDATE=$(echo "$RESPONSE" | grep -o '"updated_at":"[^"]*"' | cut -d'"' -f4)
        echo "✅ Last database update: $LAST_UPDATE"
        echo ""
        echo "If this timestamp is recent (within last 3 minutes during market hours),"
        echo "then the cron is working correctly!"
    else
        echo "⚠️  Could not fetch data from Supabase"
        echo "Response: $RESPONSE"
    fi
else
    echo "⚠️  Supabase credentials not found in environment"
    echo "Load them with: source .env.local"
fi

echo ""
echo "========================================"
