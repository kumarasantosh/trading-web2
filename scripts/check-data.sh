#!/bin/bash

# Script to check Supabase data and test API endpoints
# Usage: ./scripts/check-data.sh

echo "=== Checking Supabase Data ===\n"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Check if Supabase URL is set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
    exit 1
fi

echo "Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Check if dev server is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Next.js dev server is running"
    
    # Test the snapshots API
    echo "\n=== Testing Snapshots API ==="
    
    # Get current time and calculate range
    START_TIME=$(date -u -v-10M +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d '10 minutes ago' +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || echo "")
    END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S.000Z" || echo "")
    
    if [ -n "$START_TIME" ]; then
        echo "Testing API with time range: $START_TIME to $END_TIME"
        curl -s "http://localhost:3000/api/snapshots?type=sector&start=${START_TIME}&end=${END_TIME}" | jq '.' 2>/dev/null || curl -s "http://localhost:3000/api/snapshots?type=sector&start=${START_TIME}&end=${END_TIME}"
    else
        echo "Note: Could not calculate time range automatically"
    fi
else
    echo "✗ Next.js dev server is not running"
    echo "  Please run 'npm run dev' first"
fi

echo "\n=== Done ==="

