# Low-Level Design & Implementation Details - Trading Web 2

This document provides a comprehensive low-level design and implementation reference for the **Trading Web 2** project. It covers the system architecture, database schema, data acquisition pipelines, API services, and frontend integration.

## 1. System Architecture

The application is built on the **Next.js 14 App Router** architecture, leveraging serverless functions for backend logic and React Server Components (RSC) where applicable.

*   **Frontend**: React (Next.js), Tailwind CSS, Recharts for visualization.
*   **Backend**: Next.js API Routes (Serverless Functions) running on Vercel.
*   **Database**: Supabase (PostgreSQL) for persistent storage of market snapshots.
*   **Authentication**: Clerk (`@clerk/nextjs`) for user management.
*   **Data Sources**: Groww API (primary), NSE Website (scraping), Yahoo Finance (auxiliary).

## 2. Database Schema (Supabase PostgreSQL)

The database is designed to store time-series snapshots of market data to enable trend analysis and historical charting.

### 2.1 Table: `stock_snapshots`
Stores periodic snapshots of individual stock performance.
*   **Primary Key**: `(symbol, captured_at)` (Composite)
*   **Columns**:
    *   `captured_at` (TIMESTAMPTZ): Time of data capture.
    *   `symbol` (TEXT): Stock symbol (e.g., "RELIANCE").
    *   `sector` (TEXT): Sector name (e.g., "Energy").
    *   `ltp` (NUMERIC): Last Traded Price.
    *   `open_price` (NUMERIC): Day's open.
    *   `close_price` (NUMERIC): Previous day's close.
    *   `day_high` (NUMERIC): Day's high.
    *   `day_low` (NUMERIC): Day's low.
    *   `volume` (BIGINT): Traded volume.
    *   `change_percent` (NUMERIC): Daily percentage change.

### 2.2 Table: `sector_snapshots`
Stores performance metrics of entire sectors (e.g., Nifty Bank, IT).
*   **Primary Key**: `(sector_name, captured_at)`
*   **Columns**:
    *   `captured_at` (TIMESTAMPTZ)
    *   `sector_name` (TEXT)
    *   `last_price` (NUMERIC)
    *   `change_percent` (NUMERIC)
    *   `variation` (NUMERIC): Point change.
    *   `previous_close` (NUMERIC)
    *   `one_week_ago_val` (NUMERIC): For weekly trend.
    *   `one_month_ago_val` (NUMERIC): For monthly trend.

### 2.3 Table: `market_indices_snapshots`
Stores end-of-day or periodic snapshots for major indices (NIFTY 50, SENSEX, VIX).
*   **Primary Key**: `(index_name, captured_at)`
*   **Columns**:
    *   `captured_at` (TIMESTAMPTZ)
    *   `index_name` (TEXT)
    *   `value` (NUMERIC): Current value.
    *   `change` (NUMERIC)
    *   `change_percent` (NUMERIC)
    *   `previous_close` (NUMERIC)

### 2.4 Table: `oi_trendline`
Stores aggregated Option Chain data for constructing OI trends.
*   **Columns**:
    *   `symbol` (TEXT): Index symbol (NIFTY, BANKNIFTY).
    *   `expiry_date` (TEXT): Expiry date of the option chain.
    *   `nifty_spot` (NUMERIC): Underlying spot price.
    *   `total_put_oi` (BIGINT): Aggregated Put OI.
    *   `total_call_oi` (BIGINT): Aggregated Call OI.
    *   `pcr` (NUMERIC): Put-Call Ratio (`total_put_oi / total_call_oi`).
    *   `captured_at` (TIMESTAMPTZ)

### 2.5 Table: `pcr_data`
High-frequency storage for calculated PCR values (often restricted to ATM ±10 strikes).
*   **Columns**:
    *   `index_name` (TEXT)
    *   `pcr_value` (NUMERIC)
    *   `sentiment` (TEXT): Bullish/Bearish/Neutral based on PCR.
    *   `spot_price` (NUMERIC)
    *   `atm_strike` (NUMERIC)
    *   `captured_at` (TIMESTAMPTZ)

## 3. Data Ingestion Implementation

The system uses a combination of API clients and web scrapers to gather data.

### 3.1 Groww API Client (Stock Data)
*   **Base URL**: `https://api.groww.in/v1/live-data`
*   **Endpoints**:
    *   `/quote`: Get live LTP, OHLC for a stock.
    *   `/ltp`: Batch fetch LTP for multiple stocks.
*   **Authentication**:
    *   Requires a Bearer Token.
    *   `X-API-VERSION: 1.0` header is mandatory.
    *   **Token Management**: A helper script (`lib/groww-token.ts`) and cron job (`refresh-groww-token`) maintain a valid session token, often stored in Supabase or an environment variable to prevent expiration.

### 3.2 NSE Web Scraper (Option Chain)
*   **File**: `services/optionChain.ts`
*   **Strategy**:
    1.  **Session Init**: Fetches `https://www.nseindia.com` to obtain initial cookies.
    2.  **Page Visit**: Fetches the Option Chain UI page to reinforce session cookies.
    3.  **API Call**: Calls `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi...` with the accumulated cookies.
*   **Headers**: Mimics a real browser (`User-Agent`, `Referer`, `Accept-Language`) to avoid 403 Forbidden checks.

## 4. Backend Services & Cron Jobs
Located in `app/api/cron/`. All cron jobs are protected by a `Authorization: Bearer <CRON_SECRET>` check.

### 4.1 Stock Snapshots (`update-stock-snapshots`)
*   **Frequency**: Every 3 minutes (Market Hours).
*   **Flow**:
    1.  Loads stock list from `constants/sector-stocks-mapping`.
    2.  Batches requests (size ~3) to Groww API to avoid rate limits.
    3.  Calculates `% Change` = `((LTP - Open) / Open) * 100`.
    4.  Upserts data to `stock_snapshots` table.

### 4.2 Market Data Capture (`capture-market-data`)
*   **Frequency**: Every 5 minutes.
*   **Flow**:
    1.  Fetches sector indices from NSE API (`/api/allIndices`).
    2.  Maps NSE names (e.g., "NIFTY BANK") to internal names ("Bank Nifty").
    3.  Upserts to `sector_snapshots`.
    4.  **End of Day (3:30 PM)**: Captures major market indices (NIFTY 50, SENSEX) and performs cleanup of previous day's intraday data to save space.

### 4.3 PCR Calculation (`calculate-pcr`)
*   **Frequency**: Every 1 minute.
*   **Logic**:
    1.  Fetches Option Chain for NIFTY/BANKNIFTY.
    2.  Identifies **ATM Strike** based on current Spot Price.
    3.  Selects strikes **ATM ± 10**.
    4.  Sums Call OI and Put OI for this range.
    5.  Calculates `PCR = PutOI / CallOI`.
    6.  Determines sentiment (<0.9 Bullish, >1.1 Bearish).
    7.  Stores in `pcr_data`.

## 5. Authentication & Security

### 5.1 User Authentication
*   **Provider**: Clerk (`@clerk/nextjs`).
*   **Middleware**: `middleware.ts` protects all routes by default.
*   **Exceptions**:
    *   `/` (Landing Page)
    *   `/api/*` (API routes handle their own auth via Cron Secret)
    *   `/sign-in`, `/sign-up`

### 5.2 API Security
*   **Cron Jobs**: Protected via `CRON_SECRET` environment variable comparison.
*   **Supabase Access**:
    *   `supabase` (client): Uses Anon Key (Row Level Security applies).
    *   `supabaseAdmin` (server): Uses Service Role Key (Bypasses RLS) for backend data ingestion.

## 6. Frontend Features

### 6.1 Momentum Dashboard (`/momentum`)
*   **Top Gainers/Losers**: Fetched from `stock_snapshots` (sorted by `percent_change`).
*   **Sector Performance**: Visualized using Recharts from `sector_snapshots`.
*   **Features**:
    *   Time-frame toggle (Intraday vs Positional).
    *   Auto-refreshing tables.

### 6.2 Option Chain (`/option-chain`)
*   **Visuals**:
    *   PCR vs Nifty Spot Chart (Dual Y-Axis).
    *   OI Bar Charts (Call vs Put OI per strike).
*   **Data**: Fetched directly via `/api/option-chain` (client-side proxy to service logic) or historical from DB.

### 6.3 Stock Dashboard (`/stock-dashboard`)
*   **TradingView Integration**: Embeds TradingView Technical Analysis widgets.
*   **Fundamental Data**: Displays stats from Groww/Yahoo integration.

## 7. Configuration & Environment
Key environment variables required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CLERK_SECRET_KEY=...
CRON_SECRET=...
GROWW_API_TOKEN=...
```
