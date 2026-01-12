#!/bin/bash

# Test script for breakout snapshots system
# Tests both the cron endpoint and the frontend API

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Breakout Snapshots System${NC}\n"

# Configuration
if [ -z "$CRON_SECRET" ]; then
    CRON_SECRET="9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0"
    echo -e "${YELLOW}Note: Using default CRON_SECRET. Set CRON_SECRET env var if you have a custom value.${NC}\n"
fi
BASE_URL="http://localhost:3000"

# Test 1: Update breakout snapshots
echo "Test 1: Updating breakout snapshots..."
RESPONSE=$(curl -s -X GET "${BASE_URL}/api/cron/update-breakout-snapshots" \
  -H "Authorization: Bearer ${CRON_SECRET}")

if echo "$RESPONSE" | grep -q '"success":true'; then
    UPDATED=$(echo "$RESPONSE" | grep -o '"updated":[0-9]*' | cut -d':' -f2)
    BREAKOUTS=$(echo "$RESPONSE" | grep -o '"breakouts":[0-9]*' | cut -d':' -f2)
    BREAKDOWNS=$(echo "$RESPONSE" | grep -o '"breakdowns":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ Breakout snapshots updated: ${UPDATED} stocks (${BREAKOUTS} breakouts, ${BREAKDOWNS} breakdowns)${NC}\n"
else
    echo -e "${RED}❌ Failed: $(echo "$RESPONSE" | grep -o '"error":"[^"]*"' || echo "Internal server error")${NC}\n"
fi

# Test 2: Fetch breakouts from API
echo "Test 2: Fetching breakouts from API..."
RESPONSE=$(curl -s "${BASE_URL}/api/breakouts")

if echo "$RESPONSE" | grep -q '"success":true'; then
    BREAKOUT_COUNT=$(echo "$RESPONSE" | grep -o '"breakouts":\[[^]]*\]' | grep -o '{' | wc -l | tr -d ' ')
    BREAKDOWN_COUNT=$(echo "$RESPONSE" | grep -o '"breakdowns":\[[^]]*\]' | grep -o '{' | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ Breakouts fetched: ${BREAKOUT_COUNT} breakouts, ${BREAKDOWN_COUNT} breakdowns${NC}\n"
    
    # Display top 3 breakouts
    echo "Top 3 Breakouts:"
    echo "$RESPONSE" | jq -r '.breakouts[0:3][] | "  \(.symbol): ₹\(.current_price) (PDH: ₹\(.prev_day_high), +\(.breakout_percentage)%)"' 2>/dev/null || echo "  (jq not installed - install for formatted output)"
    echo ""
    
    # Display top 3 breakdowns
    echo "Top 3 Breakdowns:"
    echo "$RESPONSE" | jq -r '.breakdowns[0:3][] | "  \(.symbol): ₹\(.current_price) (PDL: ₹\(.prev_day_low), \(.breakdown_percentage)%)"' 2>/dev/null || echo "  (jq not installed - install for formatted output)"
    echo ""
else
    echo -e "${RED}❌ Failed to fetch breakouts${NC}\n"
fi

echo -e "${GREEN}✅ Tests complete!${NC}"
