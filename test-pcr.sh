#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CRON_SECRET="${CRON_SECRET:-9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0}"
BASE_URL="http://localhost:3000"

echo "========================================"
echo "Testing PCR Calculation System"
echo "========================================"
echo ""

# Test 1: Calculate PCR
echo -e "${BLUE}Test 1: PCR Calculation${NC}"
response=$(curl -s -X GET "${BASE_URL}/api/cron/calculate-pcr" \
  -H "Authorization: Bearer ${CRON_SECRET}")

if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ PCR Calculation API: Success${NC}"
    echo "$response" | jq '.'
else
    echo -e "${RED}❌ PCR Calculation API: Failed${NC}"
    echo "$response"
fi

echo ""
echo "----------------------------------------"
echo ""

# Test 2: Fetch PCR Data
echo -e "${BLUE}Test 2: Fetch PCR Data${NC}"
response=$(curl -s "${BASE_URL}/api/pcr-data")

if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ PCR Data API: Success${NC}"
    echo "$response" | jq '.'
else
    echo -e "${RED}❌ PCR Data API: Failed${NC}"
    echo "$response"
fi

echo ""
echo "========================================"
echo "Testing Complete!"
echo "========================================"
