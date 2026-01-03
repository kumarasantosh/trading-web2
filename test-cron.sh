#!/bin/bash

# Test script to manually trigger data capture
# This simulates what the Vercel cron job will do

echo "🧪 Testing data capture API..."
echo ""

# Get CRON_SECRET from .env.local
CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2)

if [ -z "$CRON_SECRET" ]; then
    echo "❌ Error: CRON_SECRET not found in .env.local"
    echo "Please add CRON_SECRET to your .env.local file"
    exit 1
fi

echo "📡 Calling cron endpoint..."
echo "URL: http://localhost:3000/api/cron/capture-market-data"
echo ""

# Make the request
response=$(curl -s -X GET http://localhost:3000/api/cron/capture-market-data \
  -H "Authorization: Bearer $CRON_SECRET" \
  -w "\nHTTP_STATUS:%{http_code}")

# Extract HTTP status
http_status=$(echo "$response" | grep HTTP_STATUS | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_status" = "200" ]; then
    echo "✅ Success! Data captured."
    echo ""
    echo "Next steps:"
    echo "1. Check your Supabase dashboard"
    echo "2. Go to Table Editor → sector_snapshots"
    echo "3. Verify new records were inserted"
    echo ""
    echo "🎉 Your cron job is working!"
else
    echo "❌ Error: HTTP $http_status"
    echo ""
    echo "Troubleshooting:"
    echo "- Make sure dev server is running (npm run dev)"
    echo "- Check CRON_SECRET in .env.local"
    echo "- Verify Supabase credentials are correct"
fi
