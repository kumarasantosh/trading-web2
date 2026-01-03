#!/bin/bash

# Auto-capture script - Captures market data every 5 minutes
# Usage: ./auto-capture.sh [duration_in_minutes]
# Example: ./auto-capture.sh 60  (runs for 1 hour)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
INTERVAL=300  # 5 minutes in seconds
CRON_SECRET="${CRON_SECRET:-9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0}"
MARKET_DATA_API_URL="http://localhost:3000/api/cron/capture-market-data"
OPTION_CHAIN_API_URL="http://localhost:3000/api/option-chain/cron"

# Get duration from argument or default to infinite
DURATION_MINUTES=${1:-0}
if [ "$DURATION_MINUTES" -gt 0 ]; then
    END_TIME=$(($(date +%s) + DURATION_MINUTES * 60))
    echo -e "${BLUE}🕐 Auto-capture will run for ${DURATION_MINUTES} minutes${NC}"
else
    END_TIME=0
    echo -e "${BLUE}🕐 Auto-capture will run indefinitely (Ctrl+C to stop)${NC}"
fi

echo -e "${BLUE}📊 Capturing sectors, stocks, and option chain data every 5 minutes...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}\n"

# Counter for successful captures
CAPTURE_COUNT=0

# Function to call API endpoint with retry logic
call_api() {
    local api_url=$1
    local api_name=$2
    local max_retries=3
    local retry_count=0
    local wait_time=2
    
    while [ $retry_count -lt $max_retries ]; do
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -X GET "$api_url" \
            -H "Authorization: Bearer $CRON_SECRET")
        
        http_status=$(echo "$response" | grep HTTP_STATUS | cut -d':' -f2)
        body=$(echo "$response" | sed '/HTTP_STATUS/d')
        
        if [ "$http_status" = "200" ]; then
            echo "$body"
            return 0
        elif [ "$http_status" = "404" ]; then
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                echo -e "${YELLOW}⚠️  $api_name API not ready (404), retrying in ${wait_time}s... (attempt $retry_count/$max_retries)${NC}"
                sleep $wait_time
                wait_time=$((wait_time * 2))  # Exponential backoff
            else
                echo -e "${RED}❌ Error: $api_name API still not available after $max_retries attempts${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Error: $api_name API returned HTTP ${http_status}${NC}"
            echo -e "${RED}   Response: ${body:0:200}...${NC}"
            return 1
        fi
    done
}

# Function to capture both sectors and option chain data
capture_data() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Capturing market data (sectors & option chain)...${NC}"
    
    local market_success=0
    local oi_success=0
    
    # Capture sector and stock data
    market_response=$(call_api "$MARKET_DATA_API_URL" "Market Data")
    if [ $? -eq 0 ] && [ -n "$market_response" ]; then
        market_success=1
        sectors=$(echo "$market_response" | grep -o '"sectors_captured":[0-9]*' | cut -d':' -f2)
        stocks=$(echo "$market_response" | grep -o '"stocks_captured":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✅ Market Data: ${sectors} sectors, ${stocks} stocks${NC}"
    else
        echo -e "${RED}❌ Market Data capture failed${NC}"
    fi
    
    # Capture option chain (OI) data
    oi_response=$(call_api "$OPTION_CHAIN_API_URL" "Option Chain")
    oi_exit_code=$?
    if [ $oi_exit_code -eq 0 ] && [ -n "$oi_response" ]; then
        oi_success=1
        symbol=$(echo "$oi_response" | grep -o '"symbol":"[^"]*"' | cut -d'"' -f4)
        expiry=$(echo "$oi_response" | grep -o '"expiry_date":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Option Chain: ${symbol} (${expiry})${NC}"
    else
        echo -e "${RED}❌ Option Chain capture failed${NC}"
        if [ -n "$oi_response" ]; then
            error_msg=$(echo "$oi_response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -1)
            if [ -n "$error_msg" ]; then
                echo -e "${YELLOW}   Error: ${error_msg}${NC}"
            fi
        fi
    fi
    
    if [ $market_success -eq 1 ] || [ $oi_success -eq 1 ]; then
        CAPTURE_COUNT=$((CAPTURE_COUNT + 1))
        echo -e "${GREEN}   Total captures: ${CAPTURE_COUNT}${NC}\n"
        return 0
    else
        echo -e "${RED}   All captures failed${NC}\n"
        return 1
    fi
}

# Trap Ctrl+C to show summary
trap 'echo -e "\n${YELLOW}Stopping auto-capture...${NC}"; echo -e "${GREEN}Total successful captures: ${CAPTURE_COUNT}${NC}"; exit 0' INT

# Initial capture
capture_data

# Main loop
while true; do
    # Check if we've reached the end time
    if [ "$END_TIME" -gt 0 ] && [ "$(date +%s)" -ge "$END_TIME" ]; then
        echo -e "${YELLOW}Duration completed!${NC}"
        echo -e "${GREEN}Total successful captures: ${CAPTURE_COUNT}${NC}"
        break
    fi
    
    # Wait for 5 minutes
    echo -e "${YELLOW}⏳ Waiting 5 minutes until next capture...${NC}"
    sleep $INTERVAL
    
    # Capture data
    capture_data
done
