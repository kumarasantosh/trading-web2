#!/bin/bash

# Test script for stock snapshots system
# Tests both the cron update endpoint and the top-movers API

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Stock Snapshots System${NC}\n"

# Configuration
if [ -z "$CRON_SECRET" ]; then
    CRON_SECRET="9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0"
    echo -e "${YELLOW}Note: Using default CRON_SECRET. Set CRON_SECRET env var if you have a custom value.${NC}\n"
fi
BASE_URL="http://localhost:3000"

# Test 1: Update stock snapshots
echo -e "${BLUE}Test 1: Updating stock snapshots...${NC}"
response=$(curl -s -X GET "${BASE_URL}/api/cron/update-stock-snapshots" \
  -H "Authorization: Bearer ${CRON_SECRET}")

if echo "$response" | grep -q '"success":true'; then
    stocks_updated=$(echo "$response" | grep -o '"stocks_updated":[0-9]*' | cut -d':' -f2)
    stocks_processed=$(echo "$response" | grep -o '"stocks_processed":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ Stock snapshots updated: ${stocks_updated}/${stocks_processed} stocks${NC}"
else
    error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$message" ]; then
        echo -e "${YELLOW}⏭️  ${message}${NC}"
    else
        echo -e "${RED}❌ Failed: ${error}${NC}"
    fi
fi

echo ""

# Test 2: Fetch top movers
echo -e "${BLUE}Test 2: Fetching top movers from API...${NC}"
response=$(curl -s -X GET "${BASE_URL}/api/top-movers")

if echo "$response" | grep -q '"success":true'; then
    gainers_count=$(echo "$response" | grep -o '"gainers":\[[^]]*\]' | grep -o '{' | wc -l | tr -d ' ')
    losers_count=$(echo "$response" | grep -o '"losers":\[[^]]*\]' | grep -o '{' | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ Top movers fetched: ${gainers_count} gainers, ${losers_count} losers${NC}"
    
    # Show top 3 gainers
    echo -e "\n${BLUE}Top 3 Gainers:${NC}"
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for i, stock in enumerate(data.get('gainers', [])[:3], 1):
        print(f\"  {i}. {stock['symbol']}: {stock['percent_change']:.2f}% (LTP: ₹{stock['last_price']:.2f})\")
except:
    pass
"
    
    # Show top 3 losers
    echo -e "\n${BLUE}Top 3 Losers:${NC}"
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for i, stock in enumerate(data.get('losers', [])[:3], 1):
        print(f\"  {i}. {stock['symbol']}: {stock['percent_change']:.2f}% (LTP: ₹{stock['last_price']:.2f})\")
except:
    pass
"
else
    error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo -e "${RED}❌ Failed: ${error}${NC}"
fi

echo -e "\n${GREEN}✅ Tests complete!${NC}"
