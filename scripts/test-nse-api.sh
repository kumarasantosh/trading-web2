#!/bin/bash

# Script to test if NSE API is returning the same data or different data
# This helps verify if the issue is with NSE API or our save logic

echo "Testing NSE API data freshness..."
echo "=================================="
echo ""

# Make 3 requests with a small delay to see if data changes
for i in {1..3}; do
    echo "Request $i:"
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "Time: $timestamp"
    
    response=$(curl -s 'https://www.nseindia.com/api/allIndices' \
        -H 'Accept: application/json' \
        -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' \
        -H 'Accept-Language: en-US,en;q=0.9')
    
    if [ $? -eq 0 ]; then
        # Extract a sample sector data (Metal)
        metal_data=$(echo "$response" | jq -r '.data[] | select(.index == "NIFTY METAL") | {last: .last, percentChange: .percentChange, open: .open}' 2>/dev/null)
        if [ -n "$metal_data" ]; then
            echo "$metal_data"
        else
            echo "Could not parse Metal data"
        fi
    else
        echo "Request failed"
    fi
    
    echo ""
    
    if [ $i -lt 3 ]; then
        echo "Waiting 5 seconds before next request..."
        sleep 5
        echo ""
    fi
done

echo "=================================="
echo "If all 3 requests show identical values, NSE API is returning the same data (normal if market is closed/not moving)"
echo "If values differ, NSE API is returning fresh data each time"

