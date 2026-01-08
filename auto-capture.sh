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
MARKET_INTERVAL=300  # 5 minutes in seconds (for market data)
OI_INTERVAL=180  # 3 minutes in seconds (for option chain OI data)
BREAKOUT_INTERVAL=60  # 1 minute in seconds (for breakout/breakdown checking)
PCR_INTERVAL=60  # 1 minute in seconds (for PCR calculation)
CRON_SECRET="${CRON_SECRET:-9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0}"
MARKET_DATA_API_URL="http://localhost:3000/api/cron/capture-market-data"
OPTION_CHAIN_API_URL="http://localhost:3000/api/option-chain/cron"
DAILY_HIGH_LOW_API_URL="http://localhost:3000/api/cron/save-daily-high-low"
BREAKOUT_CHECK_API_URL="http://localhost:3000/api/cron/check-breakouts"
PCR_API_URL="http://localhost:3000/api/cron/calculate-pcr"

# Get duration from argument or default to infinite
DURATION_MINUTES=${1:-0}
if [ "$DURATION_MINUTES" -gt 0 ]; then
    END_TIME=$(($(date +%s) + DURATION_MINUTES * 60))
    echo -e "${BLUE}🕐 Auto-capture will run for ${DURATION_MINUTES} minutes${NC}"
else
    END_TIME=0
    echo -e "${BLUE}🕐 Auto-capture will run indefinitely (Ctrl+C to stop)${NC}"
fi

echo -e "${BLUE}📊 Capturing data:${NC}"
echo -e "${BLUE}   - Market data (sectors): every 5 minutes${NC}"
echo -e "${BLUE}   - Option chain OI data: every 3 minutes (9:15 AM - 3:30 PM IST)${NC}"
echo -e "${BLUE}   - Breakout/Breakdown check: every 1 minute (9:15 AM - 3:30 PM IST)${NC}"
echo -e "${BLUE}   - PCR calculation: every 1 minute (9:15 AM - 3:30 PM IST)${NC}"
echo -e "${BLUE}   - Daily High-Low capture: at 3:35 PM IST (EOD)${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}\n"

# Counter for successful captures
MARKET_CAPTURE_COUNT=0
OI_CAPTURE_COUNT=0
BREAKOUT_CHECK_COUNT=0
PCR_CAPTURE_COUNT=0
DAILY_HIGH_LOW_CAPTURED=false

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

# Function to capture market data (sectors & stocks)
capture_market_data() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Capturing market data (sectors)...${NC}"
    
    market_response=$(call_api "$MARKET_DATA_API_URL" "Market Data")
    if [ $? -eq 0 ] && [ -n "$market_response" ]; then
        MARKET_CAPTURE_COUNT=$((MARKET_CAPTURE_COUNT + 1))
        sectors=$(echo "$market_response" | grep -o '"sectors_captured":[0-9]*' | cut -d':' -f2)
        # stocks=$(echo "$market_response" | grep -o '"stocks_captured":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✅ Market Data: ${sectors} sectors (total: ${MARKET_CAPTURE_COUNT})${NC}"
        return 0
    else
        echo -e "${RED}❌ Market Data capture failed${NC}"
        return 1
    fi
}

# Function to capture daily high-low data (runs at 3:35 PM IST)
capture_daily_high_low() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Capturing daily high-low (EOD)...${NC}"
    
    response=$(call_api "$DAILY_HIGH_LOW_API_URL" "Daily High-Low")
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        stocks_captured=$(echo "$response" | grep -o '"stocks_captured":[0-9]*' | cut -d':' -f2)
        stocks_inserted=$(echo "$response" | grep -o '"stocks_inserted":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✅ Daily High-Low: ${stocks_inserted} stocks saved (fetched: ${stocks_captured})${NC}"
        DAILY_HIGH_LOW_CAPTURED=true
        return 0
    else
        echo -e "${RED}❌ Daily High-Low capture failed${NC}"
        return 1
    fi
}

# Function to calculate PCR (runs every 1 minute during market hours)
calculate_pcr() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Calculating PCR...${NC}"
    
    response=$(call_api "$PCR_API_URL" "PCR Calculation")
    exit_code=$?
    if [ $exit_code -eq 0 ] && [ -n "$response" ]; then
        # Check if it was skipped
        message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$message" ]; then
            echo -e "${YELLOW}⏭️  PCR: ${message}${NC}"
            return 0
        fi
        
        # Get counts
        PCR_CAPTURE_COUNT=$((PCR_CAPTURE_COUNT + 1))
        pcr_calculated=$(echo "$response" | grep -o '"pcr_calculated":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✅ PCR: ${pcr_calculated} indices calculated (total: ${PCR_CAPTURE_COUNT})${NC}"
        return 0
    else
        echo -e "${RED}❌ PCR calculation failed${NC}"
        return 1
    fi
}

# Function to check for breakout/breakdown stocks (runs every 1 minute during market hours)
check_breakouts_breakdowns() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Checking breakouts/breakdowns...${NC}"
    
    response=$(call_api "$BREAKOUT_CHECK_API_URL" "Breakout Check")
    exit_code=$?
    if [ $exit_code -eq 0 ] && [ -n "$response" ]; then
        # Check if it was skipped
        message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$message" ]; then
            echo -e "${YELLOW}⏭️  Breakout Check: ${message}${NC}"
            return 0
        fi
        
        # Get counts
        BREAKOUT_CHECK_COUNT=$((BREAKOUT_CHECK_COUNT + 1))
        breakouts=$(echo "$response" | grep -o '"breakouts_detected":[0-9]*' | cut -d':' -f2)
        breakdowns=$(echo "$response" | grep -o '"breakdowns_detected":[0-9]*' | cut -d':' -f2)
        stocks_checked=$(echo "$response" | grep -o '"stocks_checked":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✅ Breakout Check: ${stocks_checked} stocks checked - ${breakouts} breakouts, ${breakdowns} breakdowns (total checks: ${BREAKOUT_CHECK_COUNT})${NC}"
        return 0
    else
        echo -e "${RED}❌ Breakout check failed${NC}"
        return 1
    fi
}

# Function to capture option chain OI data
capture_oi_data() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Capturing option chain OI data...${NC}"
    
    oi_response=$(call_api "$OPTION_CHAIN_API_URL" "Option Chain")
    oi_exit_code=$?
    if [ $oi_exit_code -eq 0 ] && [ -n "$oi_response" ]; then
        # Check if it was skipped due to market hours
        skipped=$(echo "$oi_response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        if [ "$skipped" = "Outside market hours" ]; then
            echo -e "${YELLOW}⏭️  Option Chain: Skipped (outside market hours)${NC}"
            return 0
        fi
        
        # Check if it was successful
        success=$(echo "$oi_response" | grep -o '"success":[^,}]*' | cut -d':' -f2 | tr -d ' ')
        if [ "$success" = "true" ]; then
            OI_CAPTURE_COUNT=$((OI_CAPTURE_COUNT + 1))
            symbol=$(echo "$oi_response" | grep -o '"symbol":"[^"]*"' | cut -d'"' -f4)
            expiry=$(echo "$oi_response" | grep -o '"expiry_date":"[^"]*"' | cut -d'"' -f4)
            putOI=$(echo "$oi_response" | grep -o '"total_put_oi":[0-9]*' | cut -d':' -f2)
            callOI=$(echo "$oi_response" | grep -o '"total_call_oi":[0-9]*' | cut -d':' -f2)
            echo -e "${GREEN}✅ Option Chain: ${symbol} (${expiry}) - Put OI: ${putOI}, Call OI: ${callOI} (total: ${OI_CAPTURE_COUNT})${NC}"
            return 0
        else
            # Check for error message
            error_msg=$(echo "$oi_response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -1)
            error_details=$(echo "$oi_response" | grep -o '"details":"[^"]*"' | cut -d'"' -f4 | head -1)
            echo -e "${RED}❌ Option Chain capture failed${NC}"
            if [ -n "$error_msg" ]; then
                echo -e "${YELLOW}   Error: ${error_msg}${NC}"
            fi
            if [ -n "$error_details" ]; then
                echo -e "${YELLOW}   Details: ${error_details}${NC}"
            fi
            # Also show full response for debugging (first 200 chars)
            echo -e "${YELLOW}   Response: ${oi_response:0:200}...${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Option Chain capture failed${NC}"
        if [ -n "$oi_response" ]; then
            error_msg=$(echo "$oi_response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -1)
            if [ -n "$error_msg" ]; then
                echo -e "${YELLOW}   Error: ${error_msg}${NC}"
            fi
            # Show full response for debugging (first 200 chars)
            echo -e "${YELLOW}   Response: ${oi_response:0:200}...${NC}"
        fi
        return 1
    fi
}

# Trap Ctrl+C to show summary
trap 'echo -e "\n${YELLOW}Stopping auto-capture...${NC}"; echo -e "${GREEN}Market data captures: ${MARKET_CAPTURE_COUNT}${NC}"; echo -e "${GREEN}OI data captures: ${OI_CAPTURE_COUNT}${NC}"; echo -e "${GREEN}Breakout checks: ${BREAKOUT_CHECK_COUNT}${NC}"; echo -e "${GREEN}PCR calculations: ${PCR_CAPTURE_COUNT}${NC}"; echo -e "${GREEN}Daily high-low captured: ${DAILY_HIGH_LOW_CAPTURED}${NC}"; exit 0' INT

# Track last capture times
LAST_MARKET_CAPTURE=0
LAST_OI_CAPTURE=0
LAST_BREAKOUT_CHECK=0
LAST_PCR_CAPTURE=0

# Initial captures
capture_market_data
LAST_MARKET_CAPTURE=$(date +%s)

capture_oi_data
LAST_OI_CAPTURE=$(date +%s)

# Main loop
while true; do
    # Check if we've reached the end time
    if [ "$END_TIME" -gt 0 ] && [ "$(date +%s)" -ge "$END_TIME" ]; then
        echo -e "${YELLOW}Duration completed!${NC}"
        echo -e "${GREEN}Market data captures: ${MARKET_CAPTURE_COUNT}${NC}"
        echo -e "${GREEN}OI data captures: ${OI_CAPTURE_COUNT}${NC}"
        break
    fi
    
    CURRENT_TIME=$(date +%s)
    
    # Check if it's time to capture market data (every 5 minutes)
    if [ $((CURRENT_TIME - LAST_MARKET_CAPTURE)) -ge $MARKET_INTERVAL ]; then
        capture_market_data
        LAST_MARKET_CAPTURE=$(date +%s)
    fi
    
    # Check if it's time to capture OI data (every 3 minutes)
    if [ $((CURRENT_TIME - LAST_OI_CAPTURE)) -ge $OI_INTERVAL ]; then
        capture_oi_data
        LAST_OI_CAPTURE=$(date +%s)
    fi
    
    # Check if it's time to check breakouts/breakdowns (every 1 minute)
    if [ $((CURRENT_TIME - LAST_BREAKOUT_CHECK)) -ge $BREAKOUT_INTERVAL ]; then
        check_breakouts_breakdowns
        LAST_BREAKOUT_CHECK=$(date +%s)
    fi
    
    # Check if it's time to calculate PCR (every 1 minute)
    if [ $((CURRENT_TIME - LAST_PCR_CAPTURE)) -ge $PCR_INTERVAL ]; then
        calculate_pcr
        LAST_PCR_CAPTURE=$(date +%s)
    fi
    
    # Check if it's 3:35 PM IST for daily high-low capture (only once per day)
    if [ "$DAILY_HIGH_LOW_CAPTURED" = false ]; then
        # Get current IST time
        IST_HOUR=$(TZ='Asia/Kolkata' date '+%H')
        IST_MINUTE=$(TZ='Asia/Kolkata' date '+%M')
        
        # Check if it's between 3:35 PM and 3:40 PM IST (15:35 - 15:40)
        if [ "$IST_HOUR" -eq 15 ] && [ "$IST_MINUTE" -ge 35 ] && [ "$IST_MINUTE" -lt 40 ]; then
            capture_daily_high_low
        fi
    fi
    
    # Wait 30 seconds before checking again (faster check for more precise timing)
    sleep 30
done
