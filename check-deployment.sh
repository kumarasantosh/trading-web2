#!/bin/bash

# Quick check to see if the new force refresh code is deployed

echo "🔍 Checking if new code is deployed..."
echo ""

# Test a quick endpoint to see logs
curl -s "https://www.ectrade.in/api/cron/refresh-groww-token" \
  -H "Authorization: Bearer 9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0" \
  | jq '.'

echo ""
echo "Check Vercel logs for:"
echo "  - '[GROWW-TOKEN] Force refreshing from Supabase...'"
echo "  - '[GROWW-TOKEN] Force loaded token from Supabase'"
echo ""
echo "If you don't see these messages, the new code isn't deployed yet."
echo ""
echo "To check deployment status:"
echo "  1. Go to https://vercel.com/dashboard"
echo "  2. Click on your project"
echo "  3. Check the 'Deployments' tab"
echo "  4. Look for commit '4d09e85' - should show 'Ready'"
