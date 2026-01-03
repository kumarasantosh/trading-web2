#!/bin/bash

# Script to verify auto-capture is working correctly
# Usage: ./scripts/verify-capture.sh

echo "=========================================="
echo "Auto-Capture Verification Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if dev server is running
echo -e "${BLUE}1. Checking if Next.js dev server is running...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Dev server is running${NC}"
else
    echo -e "${RED}✗ Dev server is not running${NC}"
    echo -e "${YELLOW}  Please start it with: npm run dev${NC}"
    exit 1
fi
echo ""

# Check verification API
echo -e "${BLUE}2. Checking database data...${NC}"
VERIFY_URL="http://localhost:3000/api/verify-capture"
VERIFY_RESPONSE=$(curl -s "$VERIFY_URL")

if [ $? -eq 0 ]; then
    echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
else
    echo -e "${RED}✗ Failed to call verification API${NC}"
    exit 1
fi
echo ""

# Check test-snapshots API
echo -e "${BLUE}3. Checking recent snapshots...${NC}"
SNAPSHOTS_URL="http://localhost:3000/api/test-snapshots?limit=5"
SNAPSHOTS_RESPONSE=$(curl -s "$SNAPSHOTS_URL")

if [ $? -eq 0 ]; then
    echo "$SNAPSHOTS_RESPONSE" | jq '.snapshots[] | {timestamp, isRounded, sectorCount}' 2>/dev/null || echo "$SNAPSHOTS_RESPONSE"
else
    echo -e "${YELLOW}⚠ Could not fetch snapshots${NC}"
fi
echo ""

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}Verification Complete${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo "For detailed database verification, run the SQL queries in:"
echo "  scripts/verify-capture-logic.md"
echo ""

