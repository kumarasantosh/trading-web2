#!/bin/bash

# Test script for daily high-low and breakout/breakdown system
# This script tests all the new API endpoints

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CRON_SECRET="${CRON_SECRET:-9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0}"
BASE_URL="http://localhost:3000"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing Daily High-Low & Breakout System${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Daily High-Low Capture
echo -e "${YELLOW}Test 1: Daily High-Low Capture (EOD)${NC}"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X GET "${BASE_URL}/api/cron/save-daily-high-low" \
    -H "Authorization: Bearer $CRON_SECRET")

http_status=$(echo "$response" | grep HTTP_STATUS | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ Daily High-Low API: Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Daily High-Low API: Failed (HTTP $http_status)${NC}"
    echo "$body"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 2: Breakout/Breakdown Check
echo -e "${YELLOW}Test 2: Breakout/Breakdown Check${NC}"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X GET "${BASE_URL}/api/cron/check-breakouts" \
    -H "Authorization: Bearer $CRON_SECRET")

http_status=$(echo "$response" | grep HTTP_STATUS | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ Breakout Check API: Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Breakout Check API: Failed (HTTP $http_status)${NC}"
    echo "$body"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 3: Fetch Breakout Stocks (Frontend API)
echo -e "${YELLOW}Test 3: Fetch Breakout Stocks${NC}"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X GET "${BASE_URL}/api/breakout-stocks")

http_status=$(echo "$response" | grep HTTP_STATUS | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ Breakout Stocks API: Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Breakout Stocks API: Failed (HTTP $http_status)${NC}"
    echo "$body"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 4: Fetch Breakdown Stocks (Frontend API)
echo -e "${YELLOW}Test 4: Fetch Breakdown Stocks${NC}"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X GET "${BASE_URL}/api/breakdown-stocks")

http_status=$(echo "$response" | grep HTTP_STATUS | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ Breakdown Stocks API: Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Breakdown Stocks API: Failed (HTTP $http_status)${NC}"
    echo "$body"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
