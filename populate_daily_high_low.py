#!/usr/bin/env python3
"""
Populate daily_high_low table with yesterday's data using yfinance
Run this script to get fresh yesterday's high/low data for breakout detection
"""

import yfinance as yf
import os
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Read stocks from the TypeScript constant file
import re

def load_stocks_from_ts():
    """Load all stocks from the SECTOR_STOCKS TypeScript file"""
    stocks_by_sector = {}
    
    try:
        with open('constants/sector-stocks-mapping.ts', 'r') as f:
            content = f.read()
            
        # Extract the SECTOR_STOCKS object (between = { and })
        match = re.search(r'export const SECTOR_STOCKS.*?=\s*{(.*?)^}', content, re.DOTALL | re.MULTILINE)
        if not match:
            print("❌ Could not parse SECTOR_STOCKS from TypeScript file")
            return {}
        
        sectors_content = match.group(1)
        
        # Parse each sector - format: 'Sector Name': ['STOCK1', 'STOCK2', ...]
        sector_pattern = r"'([^']+)':\s*\[(.*?)\]"
        for sector_match in re.finditer(sector_pattern, sectors_content, re.DOTALL):
            sector_name = sector_match.group(1)
            stocks_str = sector_match.group(2)
            
            # Extract stock symbols - handle both 'SYMBOL' and "SYMBOL" formats
            stock_symbols = re.findall(r"['\"]([A-Z&]+)['\"]", stocks_str)
            stocks_by_sector[sector_name] = stock_symbols
        
        return stocks_by_sector
    except Exception as e:
        print(f"❌ Error loading stocks from TypeScript file: {e}")
        import traceback
        traceback.print_exc()
        return {}

STOCKS = load_stocks_from_ts()

if not STOCKS:
    print("❌ Failed to load stocks from TypeScript file")
    exit(1)

print(f"✅ Loaded {len(STOCKS)} sectors with {sum(len(stocks) for stocks in STOCKS.values())} total stocks")

def get_all_symbols():
    """Get all unique stock symbols"""
    symbols = set()
    for sector_stocks in STOCKS.values():
        symbols.update(sector_stocks)
    return list(symbols)

def fetch_yesterday_data(symbol: str):
    """Fetch yesterday's high/low data from Yahoo Finance"""
    try:
        # Add .NS suffix for NSE stocks
        ticker = yf.Ticker(f"{symbol}.NS")
        
        # Get last 5 days of data to ensure we have yesterday's data
        hist = ticker.history(period="5d")
        
        if hist.empty or len(hist) < 2:
            print(f"⚠️  {symbol}: No data available")
            return None
        
        # Get yesterday's data (second last row)
        yesterday = hist.iloc[-2]
        
        return {
            "high": float(yesterday["High"]),
            "low": float(yesterday["Low"]),
            "close": float(yesterday["Close"]),
            "open": float(yesterday["Open"]),
            "volume": int(yesterday["Volume"]),
            "date": yesterday.name.strftime("%Y-%m-%d")
        }
    except Exception as e:
        print(f"❌ {symbol}: Error - {str(e)}")
        return None

def get_sector_for_symbol(symbol: str) -> str:
    """Find which sector a symbol belongs to"""
    for sector, stocks in STOCKS.items():
        if symbol in stocks:
            return sector
    return "Other"

def main():
    print("🚀 Starting daily_high_low population...")
    print(f"📅 Fetching yesterday's data from Yahoo Finance\n")
    
    symbols = get_all_symbols()
    print(f"📊 Processing {len(symbols)} stocks...\n")
    
    records = []
    success_count = 0
    error_count = 0
    
    for i, symbol in enumerate(symbols, 1):
        print(f"[{i}/{len(symbols)}] Fetching {symbol}...", end=" ")
        
        data = fetch_yesterday_data(symbol)
        
        if data:
            sector = get_sector_for_symbol(symbol)
            records.append({
                "symbol": symbol,
                "sector": sector,
                "today_high": data["high"],
                "today_low": data["low"],
                "today_open": data["open"],
                "today_close": data["close"],
                "captured_date": data["date"],
            })
            print(f"✅ High: ₹{data['high']:.2f}, Low: ₹{data['low']:.2f}, Open: ₹{data['open']:.2f}, Close: ₹{data['close']:.2f}")
            success_count += 1
        else:
            error_count += 1
    
    print(f"\n📈 Fetched {success_count} stocks successfully, {error_count} errors")
    
    if records:
        print(f"\n💾 Updating {len(records)} records in database...")
        
        # Delete existing records for today's date to ensure clean update
        today_date = records[0]["captured_date"] if records else None
        if today_date:
            print(f"🧹 Clearing existing data for {today_date}...")
            supabase.table("daily_high_low").delete().eq("captured_date", today_date).execute()
        
        # Insert fresh data
        result = supabase.table("daily_high_low").insert(records).execute()
        
        if result.data:
            print(f"✅ Successfully inserted {len(result.data)} records!")
        else:
            print("❌ Error inserting data")
    else:
        print("❌ No data to insert")
    
    print("\n🎉 Done!")

if __name__ == "__main__":
    main()
