#!/bin/bash

# Script to verify deployment and check if stock snapshots are working

echo "🔍 Verifying Stock Snapshots Deployment"
echo "========================================"
echo ""

CRON_SECRET="9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0"
BASE_URL="https://www.ectrade.in"

echo "📋 Step 1: Testing stock snapshots endpoint..."
echo "This will take ~60 seconds..."
echo ""

RESPONSE=$(curl -s -X GET "${BASE_URL}/api/cron/update-stock-snapshots" \
  -H "Authorization: Bearer ${CRON_SECRET}")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
STOCKS_UPDATED=$(echo "$RESPONSE" | jq -r '.stocks_updated' 2>/dev/null)
ERRORS=$(echo "$RESPONSE" | jq -r '.errors' 2>/dev/null)

if [ "$STOCKS_UPDATED" -gt 0 ]; then
    echo "✅ SUCCESS! Stock snapshots are working!"
    echo "   - Stocks updated: $STOCKS_UPDATED"
    echo "   - Errors: $ERRORS"
    echo ""
    echo "The cron job is now functioning correctly! 🎉"
else
    echo "❌ Still getting errors. Stocks updated: $STOCKS_UPDATED"
    echo ""
    echo "Checking error details..."
    ERROR_DETAILS=$(echo "$RESPONSE" | jq -r '.errorDetails[]' 2>/dev/null | head -5)
    echo "$ERROR_DETAILS"
    echo ""
    
    if echo "$ERROR_DETAILS" | grep -q "401"; then
        echo "⚠️  Still getting 401 errors - Token issue persists"
        echo ""
        echo "RECOMMENDED ACTION:"
        echo "1. Go to Vercel Dashboard → Settings → Environment Variables"
        echo "2. Update GROWW_API_TOKEN with the fresh token from Supabase:"
        echo ""
        echo "eyJraWQiOiJaTUtjVXciLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3Njg2MDk4MDAsImlhdCI6MTc2ODUzNjEyOSwibmJmIjoxNzY4NTM2MTI5LCJzdWIiOiJ7XCJ0b2tlblJlZklkXCI6XCI4NzZhNDVhNi1iNGE4LTQwNTEtODRkOC03NGE5ODA4OWMyMjBcIixcInZlbmRvckludGVncmF0aW9uS2V5XCI6XCJlMzFmZjIzYjA4NmI0MDZjODg3NGIyZjZkODQ5NTMxM1wiLFwidXNlckFjY291bnRJZFwiOlwiZDc2M2FkMjAtYjRhOC00MTlmLWIxMWEtYjMyYThmNTVmN2UxXCIsXCJkZXZpY2VJZFwiOlwiYmFlYmVlNjEtZTBlZi01M2JiLTk5MWQtMmI4MGZjZDY2ZTM3XCIsXCJzZXNzaW9uSWRcIjpcImU4NTMwMGRmLWQ3YWUtNGE0OC1iMmM3LWEzNDYzY2U1OWNlMlwiLFwiYWRkaXRpb25hbERhdGFcIjpcIno1NC9NZzltdjE2WXdmb0gvS0EwYk1CaWdHZEtrTnI3UVRyOTNMc29EVDVSTkczdTlLa2pWZDNoWjU1ZStNZERhWXBOVi9UOUxIRmtQejFFQisybTdRPT1cIixcInJvbGVcIjpcIm9yZGVyLWJhc2ljLGxpdmVfZGF0YS1iYXNpYyxub25fdHJhZGluZy1iYXNpYyxvcmRlcl9yZWFkX29ubHktYmFzaWMsYmFja190ZXN0XCIsXCJzb3VyY2VJcEFkZHJlc3NcIjpudWxsLFwidHdvRmFFeHBpcnlUc1wiOjE3Njg2MDk4MDAwMDB9IiwiaXNzIjoiYXBleC1hdXRoLXByb2QtYXBwIn0.GcQ5T5rqRzWKtHZVII_iNb2uVu5gQ20PW7e381emGzkgbaRLelGqCLScRNkKBr4eAv5K4nIghvTqb5TRvX5pkQ"
        echo ""
        echo "3. Redeploy the application"
        echo ""
        echo "This will immediately fix the issue while the force refresh code propagates."
    fi
fi

echo ""
echo "========================================"
echo "📊 Deployment Status Check Complete"
