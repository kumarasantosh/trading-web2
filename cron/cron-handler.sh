#!/bin/bash

# Railway Cron Handler for Trading App
# Runs every minute and coordinates multiple market data capture tasks
# Author: Trading Web2 Project
# Repository: https://github.com/kumarasantosh/trading-web2

set -e

# Configuration from environment variables
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET}"
STATE_FILE="/tmp/cron-state.json"
CURRENT_TIME=$(date +%s)

# Colors for logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S IST')] $1"
}

log_success() {
    log "${GREEN}✅ $1${NC}"
}

log_error() {
    log "${RED}❌ $1${NC}"
}

log_info() {
    log "${BLUE}ℹ️  $1${NC}"
}

log_skip() {
    log "${YELLOW}⏭️  $1${NC}"
}

# Validate required environment variables
if [ -z "$CRON_SECRET" ]; then
    log_error "CRON_SECRET environment variable not set!"
    exit 1
fi

if [ -z "$API_BASE_URL" ]; then
    log_error "API_BASE_URL environment variable not set!"
    exit 1
fi

# Initialize state file
initialize_state() {
    if [ ! -f "$STATE_FILE" ]; then
        log_info "Initializing state file..."
        echo '{
            "last_market": 0,
            "last_oi": 0,
            "last_breakout": 0,
            "last_pcr": 0,
            "last_snapshot": 0,
            "last_cleanup": 0,
            "run_count": 0
        }' > "$STATE_FILE"
    fi
}

# Read state value (works with or without jq)
get_state() {
    local key=$1
    if command -v jq &> /dev/null; then
        jq -r ".$key" "$STATE_FILE" 2>/dev/null || echo "0"
    else
        grep -o "\"$key\": [0-9]*" "$STATE_FILE" | grep -o "[0-9]*" || echo "0"
    fi
}

# Update state value (works with or without jq)
update_state() {
    local key=$1
    local value=$2
    if command -v jq &> /dev/null; then
        jq ".$key = $value" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    else
        sed -i "s/\"$key\": [0-9]*/\"$key\": $value/" "$STATE_FILE" 2>/dev/null || true
    fi
}

# Call API with retry logic
call_api() {
    local endpoint=$1
    local api_name=$2
    local max_retries=2
    local retry_count=0
    
    while [ $retry_count -le $max_retries ]; do
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X GET "${API_BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${CRON_SECRET}" \
            -H "Content-Type: application/json" \
            --connect-timeout 10 \
            --max-time 30)
        
        http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d':' -f2)
        body=$(echo "$response" | sed '/HTTP_CODE:/d')
        
        if [ "$http_code" = "200" ]; then
            echo "$body"
            return 0
        elif [ "$http_code" = "404" ] && [ $retry_count -lt $max_retries ]; then
            retry_count=$((retry_count + 1))
            log_skip "API not ready (404), retrying... (attempt $retry_count/$max_retries)"
            sleep 2
        else
            log_error "$api_name API call failed: HTTP ${http_code:-ERROR}"
            if [ -n "$body" ]; then
                log_error "Response: ${body:0:200}"
            fi
            return 1
        fi
    done
    
    return 1
}

# Check if we're in market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
is_market_hours() {
    local current_hour=$(TZ=Asia/Kolkata date +%H)
    local current_minute=$(TZ=Asia/Kolkata date +%M)
    local current_day=$(TZ=Asia/Kolkata date +%u)  # 1=Monday, 7=Sunday
    
    # Skip on weekends
    if [ "$current_day" -gt 5 ]; then
        return 1
    fi
    
    # Before market opens (9:15 AM)
    if [ "$current_hour" -lt 9 ] || [ "$current_hour" -eq 9 -a "$current_minute" -lt 15 ]; then
        return 1
    fi
    
    # After market closes (3:30 PM)
    if [ "$current_hour" -gt 15 ] || [ "$current_hour" -eq 15 -a "$current_minute" -gt 30 ]; then
        return 1
    fi
    
    return 0
}

# Task: Capture market data (every 1 minute)
run_market_data() {
    local last_run=$(get_state "last_market")
    local elapsed=$((CURRENT_TIME - last_run))
    
    if [ $elapsed -ge 60 ]; then
        log_info "Capturing market data..."
        response=$(call_api "/api/cron/capture-market-data" "Market Data")
        
        if [ $? -eq 0 ]; then
            sectors=$(echo "$response" | grep -o '"sectors_captured":[0-9]*' | cut -d':' -f2)
            log_success "Market data captured: ${sectors:-N/A} sectors"
            update_state "last_market" "$CURRENT_TIME"
        else
            log_error "Market data capture failed"
        fi
    fi
}

# Task: Calculate PCR (every 1 minute, market hours only)
run_pcr_calculation() {
    if ! is_market_hours; then
        return
    fi
    
    local last_run=$(get_state "last_pcr")
    local elapsed=$((CURRENT_TIME - last_run))
    
    if [ $elapsed -ge 60 ]; then
        log_info "Calculating PCR..."
        response=$(call_api "/api/cron/calculate-pcr" "PCR Calculation")
        
        if [ $? -eq 0 ]; then
            # Check if it was skipped
            message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$message" ]; then
                log_skip "PCR: ${message}"
            else
                pcr_calculated=$(echo "$response" | grep -o '"pcr_calculated":[0-9]*' | cut -d':' -f2)
                log_success "PCR calculated: ${pcr_calculated:-N/A} indices"
            fi
            update_state "last_pcr" "$CURRENT_TIME"
        else
            log_error "PCR calculation failed"
        fi
    fi
}

# Task: Check breakouts/breakdowns (every 1 minute, market hours only)
run_breakout_check() {
    if ! is_market_hours; then
        return
    fi
    
    local last_run=$(get_state "last_breakout")
    local elapsed=$((CURRENT_TIME - last_run))
    
    if [ $elapsed -ge 60 ]; then
        log_info "Checking breakouts/breakdowns..."
        response=$(call_api "/api/cron/check-breakouts" "Breakout Check")
        
        if [ $? -eq 0 ]; then
            message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$message" ]; then
                log_skip "Breakout check: ${message}"
            else
                breakouts=$(echo "$response" | grep -o '"breakouts_detected":[0-9]*' | cut -d':' -f2)
                breakdowns=$(echo "$response" | grep -o '"breakdowns_detected":[0-9]*' | cut -d':' -f2)
                stocks=$(echo "$response" | grep -o '"stocks_checked":[0-9]*' | cut -d':' -f2)
                log_success "Breakout check: ${stocks:-N/A} stocks - ${breakouts:-0} breakouts, ${breakdowns:-0} breakdowns"
            fi
            update_state "last_breakout" "$CURRENT_TIME"
        else
            log_error "Breakout check failed"
        fi
    fi
}

# Task: Update stock snapshots (every 1 minute, market hours only)
run_stock_snapshots() {
    if ! is_market_hours; then
        return
    fi
    
    local last_run=$(get_state "last_snapshot")
    local elapsed=$((CURRENT_TIME - last_run))
    
    if [ $elapsed -ge 60 ]; then
        log_info "Updating stock snapshots..."
        response=$(call_api "/api/cron/update-stock-snapshots" "Stock Snapshots")
        
        if [ $? -eq 0 ]; then
            message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$message" ]; then
                log_skip "Stock snapshots: ${message}"
            else
                updated=$(echo "$response" | grep -o '"stocks_updated":[0-9]*' | cut -d':' -f2)
                processed=$(echo "$response" | grep -o '"stocks_processed":[0-9]*' | cut -d':' -f2)
                log_success "Stock snapshots updated: ${updated:-0}/${processed:-0} stocks"
            fi
            update_state "last_snapshot" "$CURRENT_TIME"
        else
            log_error "Stock snapshots update failed"
        fi
    fi
}

# Task: Capture OI data (every 3 minutes, market hours only)
run_oi_capture() {
    if ! is_market_hours; then
        return
    fi
    
    local last_run=$(get_state "last_oi")
    local elapsed=$((CURRENT_TIME - last_run))
    
    if [ $elapsed -ge 180 ]; then
        log_info "Capturing option chain OI data..."
        response=$(call_api "/api/option-chain/cron" "Option Chain")
        
        if [ $? -eq 0 ]; then
            success=$(echo "$response" | grep -o '"success":true')
            message=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
            
            if [ -n "$message" ]; then
                log_skip "OI data: ${message}"
            elif [ -n "$success" ]; then
                symbol=$(echo "$response" | grep -o '"symbol":"[^"]*"' | cut -d'"' -f4)
                expiry=$(echo "$response" | grep -o '"expiry_date":"[^"]*"' | cut -d'"' -f4)
                putOI=$(echo "$response" | grep -o '"total_put_oi":[0-9]*' | cut -d':' -f2)
                callOI=$(echo "$response" | grep -o '"total_call_oi":[0-9]*' | cut -d':' -f2)
                log_success "OI data captured: ${symbol:-NIFTY} (${expiry}) - Put: ${putOI}, Call: ${callOI}"
            else
                log_error "OI capture returned unsuccessful"
            fi
            update_state "last_oi" "$CURRENT_TIME"
        else
            log_error "OI data capture failed"
        fi
    fi
}

# Task: Daily cleanup (once per day at 9:00 AM IST)
run_daily_cleanup() {
    local current_hour=$(TZ=Asia/Kolkata date +%H)
    local last_cleanup=$(get_state "last_cleanup")
    local days_since=$((($CURRENT_TIME - last_cleanup) / 86400))
    
    # Run if it's 9 AM and we haven't run today
    if [ "$current_hour" -eq 9 ] && [ $days_since -ge 1 ]; then
        log_info "Running daily cleanup..."
        response=$(call_api "/api/cron/cleanup-intraday" "Cleanup")
        
        if [ $? -eq 0 ]; then
            log_success "Daily cleanup completed"
            update_state "last_cleanup" "$CURRENT_TIME"
        else
            log_error "Daily cleanup failed"
        fi
    fi
}

# Main execution
main() {
    log_info "========== Railway Cron Handler =========="
    log_info "API URL: ${API_BASE_URL}"
    log_info "Timezone: $(date +%Z)"
    
    # Initialize state
    initialize_state
    
    # Increment run count
    run_count=$(get_state "run_count")
    update_state "run_count" $((run_count + 1))
    log_info "Run count: #$((run_count + 1))"
    
    # Check market hours
    if is_market_hours; then
        log_info "Market status: OPEN (running all tasks)"
    else
        log_info "Market status: CLOSED (limited tasks only)"
    fi
    
    # Run all tasks (they handle their own timing and market hours)
    run_market_data
    run_pcr_calculation
    run_breakout_check
    run_stock_snapshots
    run_oi_capture
    run_daily_cleanup
    
    log_info "========== Cron cycle complete =========="
}

# Execute main function
main

exit 0